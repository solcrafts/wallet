import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';

function Confirmation() {
    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [actionError, setActionError] = useState('');

    useEffect(() => {
        chrome.storage.local.get('agipocket_pending_request').then((data) => {
            if (data.agipocket_pending_request) {
                setRequest(data.agipocket_pending_request);
            }
            setLoading(false);
        });
    }, []);

    const sendDecision = (type) => {
        if (!request) return;
        if (processing) return;

        setProcessing(true);
        setActionError('');

        chrome.runtime.sendMessage({ type, id: request.id }, (response) => {
            const err = chrome.runtime.lastError;
            if (err) {
                console.error('[Confirmation] sendMessage failed:', err.message);
                setActionError(`Background unavailable: ${err.message}`);
                setProcessing(false);
                return;
            }

            if (!response?.ok) {
                const message = response?.error || 'Unknown confirmation failure';
                console.error('[Confirmation] Decision rejected by background:', message);
                setActionError(message);
                setProcessing(false);
                return;
            }

            window.close();
        });
    };

    const handleConfirm = () => sendDecision('CONFIRM_TX');
    const handleReject = () => sendDecision('REJECT_TX');

    if (loading) return <div className="page"><Card>Loading request...</Card></div>;
    if (!request) return <div className="page"><Card>No pending request found.</Card></div>;

    const { params, method } = request;
    const normalizedMethod = String(method || '').toLowerCase();
    const isMessageSignature = ['sign_message']
        .some((keyword) => normalizedMethod.includes(keyword));
    const tx = params?.[0] || {};
    const chainId = typeof tx.chainId === 'string' ? tx.chainId : String(tx.chainId || 'unknown');
    const methodLabel = String(method || 'unknown_request').replace('_', ' ');
    const messagePayload = typeof params?.[0] === 'string'
        ? params[0]
        : JSON.stringify(params?.[0] ?? params ?? '', null, 2);

    return (
        <div className={`page confirmation-page ${isMessageSignature ? 'confirmation-message' : ''}`}>
            <h2 className="confirmation-title">Confirm Request</h2>

            <Card className="col confirmation-main" style={{ minHeight: 0 }}>
                <Card variant="inset" style={{ padding: 8, textAlign: 'center' }}>
                    <span className="section-title" style={{ color: 'var(--text-secondary)' }}>{methodLabel}</span>
                </Card>

                {isMessageSignature ? (
                    <>
                        <div className="col gap-8">
                            <p className="section-title">Message</p>
                            <Card variant="inset" className="confirmation-message-box page-scroll" style={{ padding: 8 }}>
                                <p className="mono" style={{ fontSize: 11, wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
                                    {messagePayload}
                                </p>
                            </Card>
                        </div>
                        <p className="subtitle" style={{ fontSize: 11 }}>
                            Only sign messages you trust. Signature can be used to verify wallet ownership.
                        </p>
                    </>
                ) : (
                    <>
                        <div className="col gap-8">
                            <p className="section-title">Network (chainId)</p>
                            <strong>{chainId}</strong>
                        </div>

                        {tx.transaction && (
                            <div className="col gap-8">
                                <p className="section-title">Serialized Transaction</p>
                                <Card variant="inset" className="page-scroll" style={{ maxHeight: 70, padding: 8 }}>
                                    <p className="mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>{tx.transaction}</p>
                                </Card>
                            </div>
                        )}
                    </>
                )}
            </Card>

            <div className="row gap-10 confirmation-actions">
                <Button onClick={handleReject} variant="danger" disabled={processing}>
                    <XCircle size={14} /> Reject
                </Button>
                <Button onClick={handleConfirm} disabled={processing}>
                    <CheckCircle2 size={14} /> Confirm
                </Button>
            </div>
            {actionError && (
                <div className="status error">{actionError}</div>
            )}
        </div>
    );
}

export default Confirmation;

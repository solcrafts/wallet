import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, ExternalLink } from 'lucide-react';
import Button from '../components/Button';
import Input from '../components/Input';
import Card from '../components/Card';
import { TransactionController } from '../lib/transaction';
import { KeyringController } from '../lib/keyring';

function Send({ onBack, network, networkController }) {
    const [to, setTo] = useState('');
    const [amount, setAmount] = useState('');
    const [status, setStatus] = useState('');
    const [txDetails, setTxDetails] = useState(null);

    const handleSend = async () => {
        setStatus('signing');
        try {
            const keyring = new KeyringController();
            await keyring.load();
            const provider = await networkController.getProvider(network);
            const txController = new TransactionController(keyring, provider);

            const tx = await txController.sendTransaction(to, amount);
            setTxDetails(tx);
            setStatus('sent');
        } catch (e) {
            setStatus(`error: ${e.message}`);
        }
    };

    const openExplorer = () => {
        if (!txDetails?.hash) return;
        const explorerUrl = networkController.getNetwork(network).blockExplorer;
        if (explorerUrl) {
            window.open(`${explorerUrl}/tx/${txDetails.hash}`, '_blank');
        }
    };

    const symbol = networkController.getNetwork(network)?.symbol || 'SOL';

    return (
        <div className="page">
            <div className="row gap-10">
                <Button onClick={onBack} className="icon-btn" variant="ghost" aria-label="Back">
                    <ArrowLeft size={16} />
                </Button>
                <div className="col">
                    <h2 style={{ fontSize: 22 }}>Send on Solana</h2>
                    <p className="subtitle">Transfer assets securely with manual confirmation.</p>
                </div>
            </div>

            {status === 'sent' ? (
                <Card className="col center gap-12" style={{ flex: 1 }}>
                    <CheckCircle2 size={40} color="#1f9f61" />
                    <h3>Transaction Sent</h3>
                    <p className="subtitle" style={{ textAlign: 'center' }}>The transaction was broadcast to the network.</p>
                    <Button onClick={openExplorer}>
                        <ExternalLink size={14} /> View on Explorer
                    </Button>
                    <Button onClick={onBack} variant="ghost">Return Home</Button>
                </Card>
            ) : (
                <>
                    <Card className="col gap-12">
                        <div className="col gap-8">
                            <p className="section-title">Recipient</p>
                            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Recipient base58 address" />
                        </div>

                        <div className="col gap-8">
                            <p className="section-title">Amount</p>
                            <div className="row gap-8" style={{ alignItems: 'center' }}>
                                <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.0" type="number" />
                                <Card variant="inset" style={{ minWidth: 62, textAlign: 'center', padding: '10px 12px' }}>
                                    <strong>{symbol}</strong>
                                </Card>
                            </div>
                        </div>
                    </Card>

                    {status.startsWith('error') && <div className="status error">{status}</div>}

                    <Button
                        onClick={handleSend}
                        disabled={!to || !amount || status === 'signing'}
                        style={{ marginTop: 'auto' }}
                    >
                        {status === 'signing' ? 'Signing Transaction...' : 'Confirm Send'}
                    </Button>
                </>
            )}
        </div>
    );
}

export default Send;


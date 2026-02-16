import React from 'react';
import { ArrowLeft, Copy } from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import { KeyringController } from '../lib/keyring';
import QRCode from 'react-qr-code';

function Receive({ onBack }) {
    const [address, setAddress] = React.useState('');
    const [copied, setCopied] = React.useState(false);

    React.useEffect(() => {
        const keyring = new KeyringController();
        keyring.load().then(() => {
            setAddress(keyring.getAddress());
        });
    }, []);

    const copyAddress = () => {
        if (!address) return;
        navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="page">
            <div className="row gap-10">
                <Button onClick={onBack} className="icon-btn" variant="ghost" aria-label="Back">
                    <ArrowLeft size={16} />
                </Button>
                <div className="col">
                    <h2 style={{ fontSize: 22 }}>Receive</h2>
                    <p className="subtitle">Share this address or QR code to receive funds.</p>
                </div>
            </div>

            <Card className="col center gap-12" style={{ flex: 1 }}>
                <Card variant="inset" className="row center" style={{ width: 210, height: 210, borderRadius: 22 }}>
                    {address && (
                        <QRCode
                            value={address}
                            size={166}
                            style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                            viewBox="0 0 256 256"
                            fgColor="#3d2a03"
                            bgColor="transparent"
                        />
                    )}
                </Card>

                <div className="col gap-8" style={{ textAlign: 'center' }}>
                    <p className="section-title">Wallet Address</p>
                    <p className="mono" style={{ wordBreak: 'break-all', fontSize: 12 }}>{address}</p>
                </div>
            </Card>

            <Button onClick={copyAddress} style={{ marginTop: 'auto' }}>
                <Copy size={14} /> {copied ? 'Address Copied' : 'Copy Address'}
            </Button>
        </div>
    );
}

export default Receive;

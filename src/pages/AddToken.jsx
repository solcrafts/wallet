import React, { useState } from 'react';
import { ArrowLeft, Coins } from 'lucide-react';
import Button from '../components/Button';
import Input from '../components/Input';
import Card from '../components/Card';
import { TokenController } from '../lib/tokens';

function AddToken({ onBack, network, networkController }) {
    const [address, setAddress] = useState('');
    const [msg, setMsg] = useState('');
    const [status, setStatus] = useState('');

    const handleAdd = async () => {
        if (!address) return;
        setStatus('loading');
        setMsg('');
        try {
            const provider = await networkController.getProvider(network);
            const tokenController = new TokenController();
            await tokenController.load();

            const symbol = await tokenController.addToken(network, address, provider);
            setStatus('success');
            setMsg(`Successfully added ${symbol}.`);
            setTimeout(() => {
                onBack();
            }, 1500);
        } catch (e) {
            setStatus('error');
            setMsg(e.message);
        }
    };

    return (
        <div className="page">
            <div className="row gap-10">
                <Button onClick={onBack} className="icon-btn" variant="ghost" aria-label="Back">
                    <ArrowLeft size={16} />
                </Button>
                <div className="col">
                    <h2 style={{ fontSize: 22 }}>Add Token</h2>
                    <p className="subtitle">Import SPL token on selected Solana cluster.</p>
                </div>
            </div>

            <Card className="col gap-12" style={{ flex: 1 }}>
                <p className="row gap-8"><Coins size={16} /><strong>Contract Address</strong></p>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Mint address (base58)" />

                <Card variant="inset" style={{ padding: 12 }}>
                    <p className="subtitle">Paste the token mint address and verify legitimacy before importing.</p>
                </Card>

                {msg && <div className={`status ${status === 'error' ? 'error' : 'success'}`}>{msg}</div>}
            </Card>

            <Button onClick={handleAdd} disabled={!address || status === 'loading'} style={{ marginTop: 'auto' }}>
                {status === 'loading' ? 'Verifying...' : 'Add Token'}
            </Button>
        </div>
    );
}

export default AddToken;

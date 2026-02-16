import React, { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownLeft, Settings, Copy, Plus } from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import NetworkSelector from '../components/NetworkSelector';
import { TransactionController } from '../lib/transaction';
import { KeyringController } from '../lib/keyring';
import { TokenController } from '../lib/tokens';
import logo from '../res/logo.png';

const shortAddress = (value) => {
    if (typeof value !== 'string' || value.length < 10) return value || 'N/A';
    return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

function Home({ onSend, onReceive, onSettings, onAddToken, network, setNetwork, networkController }) {
    const [balance, setBalance] = useState('0.00');
    const [address, setAddress] = useState('');
    const [copied, setCopied] = useState(false);
    const [networks, setNetworks] = useState(networkController.getAllNetworks());
    const [tokens, setTokens] = useState([]);

    useEffect(() => {
        setNetworks(networkController.getAllNetworks());

        const loadCache = async () => {
            const keyring = new KeyringController();
            if (await keyring.load()) {
                const userAddress = keyring.getAddress();
                setAddress(userAddress);

                const cacheKey = `agipocket_cache_${network}_${userAddress}`;
                const cached = await chrome.storage.local.get(cacheKey);
                if (cached[cacheKey]) {
                    const data = JSON.parse(cached[cacheKey]);
                    setBalance(data.balance || '0.00');
                    setTokens(data.tokens || []);
                }

                fetchData(keyring, userAddress);
            }
        };

        loadCache();
    }, [network, networkController]);

    useEffect(() => {
        const interval = setInterval(() => {
            setNetworks(networkController.getAllNetworks());
        }, 5000);
        return () => clearInterval(interval);
    }, [networkController]);

    const fetchData = async (keyring, userAddress) => {
        try {
            const provider = await networkController.getProvider(network);
            const txController = new TransactionController(keyring, provider);

            const bal = await txController.getBalance();
            const formattedBal = Number(bal).toFixed(4);
            setBalance(formattedBal);

            const tokenController = new TokenController();
            await tokenController.load();
            const storedTokens = tokenController.getTokens(network);
            const tokenBalances = await tokenController.getTokenBalances(network, userAddress, provider);

            const tokensWithBal = storedTokens.map((token) => ({
                ...token,
                balance: tokenBalances[token.address] || '0'
            }));
            setTokens(tokensWithBal);

            const cacheKey = `agipocket_cache_${network}_${userAddress}`;
            await chrome.storage.local.set({
                [cacheKey]: JSON.stringify({
                    balance: formattedBal,
                    tokens: tokensWithBal,
                    timestamp: Date.now()
                })
            });
        } catch (e) {
            console.error('Background fetch failed', e);
        }
    };

    const copyAddress = () => {
        if (!address) return;
        navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="page">
            <div className="row-between gap-10 home-topbar">
                <div className="logo-box">
                    <img src={logo} alt="AGIPOCKET" style={{ width: '100%', height: '100%' }} />
                </div>
                <NetworkSelector network={network} setNetwork={setNetwork} networks={networks} />
                <Button onClick={onSettings} className="icon-btn" variant="ghost" aria-label="Settings">
                    <Settings size={16} />
                </Button>
            </div>

            <Card className="col center gap-12" style={{ padding: 22 }}>
                <p className="section-title">Total Balance</p>
                <div className="big-balance">
                    {balance} <span style={{ fontSize: 15 }}>{networks[network]?.symbol || ''}</span>
                </div>
                <button type="button" className="addr-pill row gap-8" onClick={copyAddress}>
                    {address ? shortAddress(address) : 'No Address'}
                    <Copy size={12} />
                    {copied ? 'Copied' : ''}
                </button>
            </Card>

            <div className="row" style={{ gap: 10 }}>
                <Card className="col center gap-10" style={{ flex: 1, padding: 12 }}>
                    <Button onClick={onSend} className="icon-btn" aria-label="Send">
                        <ArrowUpRight size={18} />
                    </Button>
                    <p className="subtitle">Send</p>
                </Card>
                <Card className="col center gap-10" style={{ flex: 1, padding: 12 }}>
                    <Button onClick={onReceive} className="icon-btn" aria-label="Receive">
                        <ArrowDownLeft size={18} />
                    </Button>
                    <p className="subtitle">Receive</p>
                </Card>
            </div>

            <Card className="col" style={{ flex: 1, minHeight: 0, padding: 14 }}>
                <div className="row-between" style={{ marginBottom: 10 }}>
                    <p className="section-title">Assets</p>
                    <Button onClick={onAddToken} size="sm" style={{ width: 'auto', paddingInline: 10 }}>
                        <Plus size={13} /> Add
                    </Button>
                </div>

                <div className="page-scroll" style={{ flex: 1, minHeight: 0 }}>
                    {tokens.length === 0 ? (
                        <Card variant="inset" className="col center" style={{ minHeight: 120 }}>
                            <p className="muted">No SPL tokens imported.</p>
                        </Card>
                    ) : (
                        <div className="asset-list">
                            {tokens.map((token) => (
                                <Card key={token.address} className="asset-item" style={{ padding: 12 }}>
                                    <div className="row gap-10">
                                        <div className="token-badge">{token.symbol?.[0] || '?'}</div>
                                        <div className="col">
                                            <strong>{token.symbol}</strong>
                                            <span className="subtitle mono">{shortAddress(token?.address)}</span>
                                        </div>
                                    </div>
                                    <strong>{Number(token.balance).toFixed(4)}</strong>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}

export default Home;

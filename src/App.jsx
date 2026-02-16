import React, { useState, useEffect, Suspense } from 'react';
import './styles/neu.css';
import { AGI_STORAGE_KEYS, cleanupLegacyStorage } from './lib/storageKeys';

const Home = React.lazy(() => import('./pages/Home'));
const Welcome = React.lazy(() => import('./pages/Welcome'));
const Send = React.lazy(() => import('./pages/Send'));
const Receive = React.lazy(() => import('./pages/Receive'));
const Settings = React.lazy(() => import('./pages/Settings'));
const AddToken = React.lazy(() => import('./pages/AddToken'));
const Confirmation = React.lazy(() => import('./pages/Confirmation'));

const Loader = () => (
    <div className="page">
        <div className="panel row center" style={{ flex: 1 }}>
            <p className="section-title">Loading...</p>
        </div>
    </div>
);

function App() {
    const [view, setView] = useState('loading');
    const [network, setNetwork] = useState('solana_mainnet');
    const [networkController, setNetworkController] = useState(null);

    useEffect(() => {
        const init = async () => {
            try {
                await cleanupLegacyStorage();

                if (window.location.hash === '#confirm') {
                    setView('confirmation');
                    return;
                }

                const { NetworkController } = await import('./lib/networks');
                const { KeyringController } = await import('./lib/keyring');

                const nc = new NetworkController();
                await nc.load();
                setNetworkController(nc);

                const netData = await chrome.storage.local.get(AGI_STORAGE_KEYS.NETWORK);
                if (netData[AGI_STORAGE_KEYS.NETWORK]) {
                    setNetwork(netData[AGI_STORAGE_KEYS.NETWORK]);
                } else {
                    setNetwork(nc.getDefaultNetworkKey());
                }

                const keyring = new KeyringController();
                const hasWallet = await keyring.load();
                if (hasWallet) {
                    setView('home');
                } else {
                    setView('welcome');
                }
            } catch (e) {
                console.error('Failed to init app', e);
                setView('welcome');
            }
        };
        init();
    }, []);

    useEffect(() => {
        if (network) {
            chrome.storage.local.set({ [AGI_STORAGE_KEYS.NETWORK]: network });
        }
    }, [network]);

    const handleWalletCreated = () => {
        setView('home');
    };

    return (
        <Suspense fallback={<Loader />}>
            {view === 'loading' && <Loader />}
            {view === 'welcome' && <Welcome onComplete={handleWalletCreated} />}

            {view === 'home' && networkController && (
                <Home
                    onSend={() => setView('send')}
                    onReceive={() => setView('receive')}
                    onSettings={() => setView('settings')}
                    onAddToken={() => setView('add-token')}
                    network={network}
                    setNetwork={setNetwork}
                    networkController={networkController}
                />
            )}

            {view === 'send' && networkController && (
                <Send onBack={() => setView('home')} network={network} networkController={networkController} />
            )}

            {view === 'receive' && <Receive onBack={() => setView('home')} />}

            {view === 'settings' && networkController && (
                <Settings onBack={() => setView('home')} networkController={networkController} />
            )}

            {view === 'add-token' && networkController && (
                <AddToken onBack={() => setView('home')} network={network} networkController={networkController} />
            )}

            {view === 'confirmation' && <Confirmation />}
        </Suspense>
    );
}

export default App;

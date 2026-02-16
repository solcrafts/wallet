console.log('Background script initialized');

const processShim = globalThis.process || {};
if (!processShim.env) processShim.env = {};
if (!processShim.version) processShim.version = 'v18.0.0';
if (!processShim.versions) processShim.versions = { node: '18.0.0' };
if (typeof processShim.nextTick !== 'function') {
  processShim.nextTick = (callback, ...args) => Promise.resolve().then(() => callback(...args));
}
if (typeof processShim.cwd !== 'function') processShim.cwd = () => '/';
processShim.browser = true;
globalThis.process = processShim;
if (!globalThis.global) globalThis.global = globalThis;
if (!globalThis.window) globalThis.window = globalThis;
if (!globalThis.self) globalThis.self = globalThis;

async function bootstrap() {
    const { RelayController } = await import('../lib/relay');
    const relay = new RelayController();
    relay.init().catch(console.error);

    // Keep-Alive Alarm (1 minute interval)
    chrome.alarms.create('keepAlive', { periodInMinutes: 1 });

    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'keepAlive') {
            console.log('[Background] Keep-Alive Alarm Triggered');
            relay.checkConnection();
        }
    });

    // Open Settings on Install (Optional, but good for demo)
    chrome.runtime.onInstalled.addListener(() => {
        // chrome.runtime.openOptionsPage();
    });
}

try {
    bootstrap().catch((error) => {
        console.error('[Background] Async bootstrap failed:', error);
    });
} catch (error) {
    console.error('[Background] Bootstrap failed:', error);
}

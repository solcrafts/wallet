import nacl from 'tweetnacl';
import bs58Module from 'bs58';
import { WorkerKeyringController } from './keyring.worker';
import { NetworkController } from './networks';
import { AGI_STORAGE_KEYS, agiNonceKey, cleanupLegacyStorage } from './storageKeys';

const DEFAULT_RELAY_URL = 'wss://wallet-relay.solcraft.top';
const LEGACY_RELAY_URLS = new Set(['ws://localhost:8080', 'ws://localhost:8080/']);
const bs58 = bs58Module.default || bs58Module;

export class RelayController {
  constructor() {
    this.ws = null;
    this.url = null;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.keyring = new WorkerKeyringController();
    this.networkController = new NetworkController();
    this.isConnected = false;
    this.manuallyDisconnected = false;
    this.pendingResolvers = new Map();
  }

  findPendingResolver(id) {
    if (this.pendingResolvers.has(id)) {
      return { key: id, resolver: this.pendingResolvers.get(id) };
    }

    const target = String(id);
    for (const [key, resolver] of this.pendingResolvers.entries()) {
      if (String(key) === target) {
        return { key, resolver };
      }
    }

    return null;
  }

  async init() {
    await cleanupLegacyStorage();
    await this.networkController.load();

    const data = await chrome.storage.local.get(AGI_STORAGE_KEYS.RELAY_URL);
    const storedRelayUrl = data[AGI_STORAGE_KEYS.RELAY_URL];
    const relayUrl = !storedRelayUrl || LEGACY_RELAY_URLS.has(storedRelayUrl)
      ? DEFAULT_RELAY_URL
      : storedRelayUrl;
    await chrome.storage.local.set({ [AGI_STORAGE_KEYS.RELAY_URL]: relayUrl });
    this.connect(relayUrl);

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'RELAY_CONFIG_UPDATED' && message.url) {
        this.manuallyDisconnected = false;
        this.connect(message.url);
      } else if (message.type === 'GET_RELAY_STATUS') {
        sendResponse({ connected: this.isConnected, url: this.url });
      } else if (message.type === 'TOGGLE_RELAY') {
        if (this.isConnected) {
          this.disconnect();
          this.manuallyDisconnected = true;
        } else {
          this.manuallyDisconnected = false;
          if (this.url) this.connect(this.url);
        }
        sendResponse({ connected: this.isConnected });
      } else if (message.type === 'WALLET_UNLOCKED') {
        if (this.url && !this.isConnected && !this.manuallyDisconnected) {
          this.connect(this.url);
        }
      } else if (message.type === 'CONFIRM_TX') {
        const found = this.findPendingResolver(message.id);
        if (found?.resolver) {
          console.log('[Relay] Received CONFIRM_TX:', { id: message.id, pending: this.pendingResolvers.size });
          found.resolver.resolve(true);
          this.pendingResolvers.delete(found.key);
          chrome.storage.local.remove(AGI_STORAGE_KEYS.PENDING_REQUEST).catch(() => { });
          sendResponse({ ok: true });
        } else {
          console.warn('[Relay] CONFIRM_TX ignored: pending request not found', {
            id: message.id,
            pendingKeys: Array.from(this.pendingResolvers.keys()).map((k) => String(k))
          });
          sendResponse({ ok: false, error: 'Pending request not found' });
        }
      } else if (message.type === 'REJECT_TX') {
        const found = this.findPendingResolver(message.id);
        if (found?.resolver) {
          console.log('[Relay] Received REJECT_TX:', { id: message.id, pending: this.pendingResolvers.size });
          found.resolver.reject(new Error('User rejected the request'));
          this.pendingResolvers.delete(found.key);
          chrome.storage.local.remove(AGI_STORAGE_KEYS.PENDING_REQUEST).catch(() => { });
          sendResponse({ ok: true });
        } else {
          console.warn('[Relay] REJECT_TX ignored: pending request not found', {
            id: message.id,
            pendingKeys: Array.from(this.pendingResolvers.keys()).map((k) => String(k))
          });
          sendResponse({ ok: false, error: 'Pending request not found' });
        }
      }
      return true;
    });
  }

  checkConnection() {
    if (this.manuallyDisconnected) return;
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (this.url) this.connect(this.url);
    }
  }

  startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 20000);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
  }

  connect(url) {
    if (this.ws) {
      try { this.ws.close(); } catch { }
    }

    this.url = url;
    this.stopHeartbeat();

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = async () => {
        this.isConnected = true;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

        this.startHeartbeat();
        await this.sendAuth();
      };

      this.ws.onmessage = async (event) => {
        try {
          const envelope = JSON.parse(event.data);
          if (envelope.type === 'pong') return;

          if (envelope.method === 'get_address' && envelope.id === 0) {
            await this.handleHandshake(envelope);
          } else if (envelope.type === 'auth_success') {
            console.log('[Relay] Auth Success:', envelope.message);
          } else if (envelope.type === 'auth_error') {
            console.error('[Relay] Auth Error:', envelope.message);
            this.stopHeartbeat();
            this.ws.close();
          } else {
            await this.handleRelayMessage(envelope);
          }
        } catch {
          // ignore invalid packet
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.stopHeartbeat();
        if (!this.manuallyDisconnected) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        this.isConnected = false;
      };
    } catch {
      this.isConnected = false;
      if (!this.manuallyDisconnected) {
        this.scheduleReconnect();
      }
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.manuallyDisconnected) return;

    this.reconnectTimer = setTimeout(() => {
      if (this.url) this.connect(this.url);
    }, 5000);
  }

  async sendAuth() {
    if (!(await this.keyring.load())) {
      this.ws.close();
      return;
    }

    const address = this.keyring.getAddress();
    const payload = {
      timestamp: Date.now(),
      address,
      publicKey: address
    };

    const signature = await this.keyring.signMessage(JSON.stringify(payload));

    this.ws.send(JSON.stringify({
      type: 'wallet_auth',
      payload,
      signature
    }));
  }

  async handleHandshake(req) {
    try {
      const pubData = await chrome.storage.local.get(AGI_STORAGE_KEYS.PUBLIC_ADDRESS);
      const address = pubData[AGI_STORAGE_KEYS.PUBLIC_ADDRESS] || null;
      this.ws.send(JSON.stringify({
        id: req.id,
        result: address,
        error: address ? null : 'Wallet not initialized'
      }));
    } catch (e) {
      console.error('Handshake failed:', e);
    }
  }

  validateChainId(method, params) {
    if (method !== 'sign_transaction' && method !== 'send_transaction') return null;

    const tx = params?.[0];
    const chainId = tx?.chainId;

    if (!chainId || (typeof chainId !== 'string' && typeof chainId !== 'number')) {
      throw this.makeRpcError('Missing or invalid chainId (expected mainnet/devnet/testnet)', -32602);
    }

    const networkKey = this.networkController.getNetworkKeyByChainId(chainId);
    if (!networkKey) {
      throw this.makeRpcError('Missing or invalid chainId (expected mainnet/devnet/testnet)', -32602);
    }

    const network = this.networkController.getNetwork(networkKey);
    if (!network) {
      throw this.makeRpcError('Missing or invalid chainId (expected mainnet/devnet/testnet)', -32602);
    }

    return { network, networkKey };
  }

  makeRpcError(message, code = -32603) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  async handleRelayMessage(envelope) {
    const { protocol, data, auth } = envelope;

    if (!data || !auth || protocol !== 'ed25519/v1') return;

    try {
      console.log('[Relay] Incoming request:', { nonce: data?.nonce, id: data?.id, method: data?.method });
      const senderPubkeyBytes = this.pubkeyToBytes(auth.pubkey);
      if (!senderPubkeyBytes || senderPubkeyBytes.length !== 32) {
        throw this.makeRpcError('Invalid sender public key format', -32603);
      }
      const senderPubkeyHex = this.bytesToHex(senderPubkeyBytes);

      const whitelistData = await chrome.storage.local.get(AGI_STORAGE_KEYS.WHITELIST);
      const whitelist = whitelistData[AGI_STORAGE_KEYS.WHITELIST] || [];
      const isWhitelisted = whitelist.some((entry) => {
        const candidateBytes = this.pubkeyToBytes(entry);
        if (!candidateBytes || candidateBytes.length !== senderPubkeyBytes.length) return false;
        for (let i = 0; i < senderPubkeyBytes.length; i += 1) {
          if (candidateBytes[i] !== senderPubkeyBytes[i]) return false;
        }
        return true;
      });

      if (!isWhitelisted) {
        throw this.makeRpcError('Sender Public Key not in whitelist', -32603);
      }

      const nonceKey = agiNonceKey(senderPubkeyHex);
      const nonceData = await chrome.storage.local.get(nonceKey);
      const lastNonce = nonceData[nonceKey] || -1;
      if (typeof data.nonce !== 'number' || data.nonce <= lastNonce) {
        throw this.makeRpcError(`Invalid nonce. Expected > ${lastNonce}, got ${data.nonce}`, -32603);
      }

      const messageString = JSON.stringify(data);
      const messageBytes = new TextEncoder().encode(messageString);
      const signatureBytes = this.signatureToBytes(auth.signature);
      if (!signatureBytes || signatureBytes.length !== 64) {
        throw this.makeRpcError('Invalid signature format', -32603);
      }

      if (!nacl.sign.detached.verify(messageBytes, signatureBytes, senderPubkeyBytes)) {
        throw this.makeRpcError('Invalid Ed25519 signature', -32603);
      }

      await chrome.storage.local.set({ [nonceKey]: data.nonce });

      const result = await this.executeMethod(data.method, data.params, data.id, data.nonce);
      await this.sendSignedResponse(data.id, data.nonce, result);
    } catch (e) {
      console.error('[Relay] Request failed:', {
        nonce: data?.nonce,
        id: data?.id,
        method: data?.method,
        error: e?.message || String(e)
      });
      await this.sendSignedError(data?.id, data?.nonce, e.message, e.code || -32603);
    }
  }

  async executeMethod(method, params, id, nonce) {
    switch (method) {
      case 'get_address': {
        const pubData = await chrome.storage.local.get(AGI_STORAGE_KEYS.PUBLIC_ADDRESS);
        if (!pubData[AGI_STORAGE_KEYS.PUBLIC_ADDRESS]) throw this.makeRpcError('Wallet not initialized', -32603);
        return pubData[AGI_STORAGE_KEYS.PUBLIC_ADDRESS];
      }

      case 'sign_transaction': {
        if (!(await this.keyring.load())) throw this.makeRpcError('Wallet Locked. Please unlock to sign.', -32603);
        const resolved = this.validateChainId(method, params);

        await this.requestUserApproval(id ?? nonce, method, params);

        const txReq = params?.[0] || {};
        if (!txReq.transaction || typeof txReq.transaction !== 'string') {
          throw this.makeRpcError('Missing serialized transaction in params[0].transaction', -32602);
        }

        return await this.keyring.signTransaction(txReq.transaction, resolved?.network?.rpcUrl);
      }

      case 'send_transaction': {
        if (!(await this.keyring.load())) throw this.makeRpcError('Wallet Locked. Please unlock to send.', -32603);
        const resolved = this.validateChainId(method, params);

        await this.requestUserApproval(id ?? nonce, method, params);

        const txReq = params?.[0] || {};
        if (!txReq.transaction || typeof txReq.transaction !== 'string') {
          throw this.makeRpcError('Missing serialized transaction in params[0].transaction', -32602);
        }

        const connection = await this.networkController.getProvider(resolved.networkKey);

        return await this.keyring.sendSerializedTransaction(txReq.transaction, connection, {
          skipPreflight: txReq.skipPreflight,
          maxRetries: txReq.maxRetries
        });
      }

      case 'sign_message': {
        if (!(await this.keyring.load())) throw this.makeRpcError('Wallet Locked. Please unlock to sign.', -32603);

        await this.requestUserApproval(id ?? nonce, method, params);

        const payload = params?.[0];
        if (payload === undefined || payload === null) {
          throw this.makeRpcError('Missing message payload', -32602);
        }

        return await this.keyring.signMessage(typeof payload === 'string' ? payload : JSON.stringify(payload));
      }

      default:
        throw this.makeRpcError(`Method not supported: ${method}`, -32601);
    }
  }

  async sendSignedResponse(id, requestNonce, result) {
    const responseData = {
      nonce: requestNonce,
      id,
      result,
      error: null
    };

    const signature = await this.keyring.signMessage(JSON.stringify(responseData));
    const address = this.keyring.getAddress();

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw this.makeRpcError('Relay socket not connected when sending response', -32603);
    }

    this.ws.send(JSON.stringify({
      protocol: 'ed25519/v1',
      data: responseData,
      auth: { address, signature }
    }));
    console.log('[Relay] Response sent:', { nonce: requestNonce, id });
  }

  async sendSignedError(id, nonce, errorMsg, code = -32603) {
    const responseData = {
      nonce,
      id,
      result: null,
      error: errorMsg,
      code
    };

    try {
      if (!(await this.keyring.load())) return;
      const signature = await this.keyring.signMessage(JSON.stringify(responseData));
      const address = this.keyring.getAddress();

      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        console.error('[Relay] Failed to send signed error: relay socket is closed', { nonce, id, errorMsg });
        return;
      }

      this.ws.send(JSON.stringify({
        protocol: 'ed25519/v1',
        data: responseData,
        auth: { address, signature }
      }));
      console.log('[Relay] Error response sent:', { nonce, id, code, errorMsg });
    } catch (e) {
      console.error('[Relay] Failed to sign error response:', e);
    }
  }

  async requestUserApproval(id, method, params) {
    const settings = await chrome.storage.local.get(AGI_STORAGE_KEYS.AUTO_CONFIRM);
    if (settings[AGI_STORAGE_KEYS.AUTO_CONFIRM]) return true;

    const approvalId = id ?? Date.now();
    await chrome.storage.local.set({
      [AGI_STORAGE_KEYS.PENDING_REQUEST]: {
        id: approvalId,
        method,
        params,
        createdAt: Date.now()
      }
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingResolvers.delete(approvalId);
        chrome.storage.local.remove(AGI_STORAGE_KEYS.PENDING_REQUEST).catch(() => { });
        reject(this.makeRpcError('User approval timeout', -32000));
      }, 120000);

      this.pendingResolvers.set(approvalId, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });

      chrome.windows.create({
        url: 'index.html#confirm',
        type: 'popup',
        width: 360,
        height: 600
      }).then(() => {
        console.log('[Relay] Confirmation window opened:', {
          id: approvalId,
          method,
          pending: this.pendingResolvers.size
        });
      }).catch((error) => {
        clearTimeout(timeout);
        this.pendingResolvers.delete(approvalId);
        chrome.storage.local.remove(AGI_STORAGE_KEYS.PENDING_REQUEST).catch(() => { });
        reject(this.makeRpcError(`Failed to open confirmation window: ${error.message}`, -32603));
      });
    });
  }

  normalizeHex(hex) {
    if (typeof hex !== 'string') return null;
    const normalized = hex.trim().replace(/^0x/i, '').toLowerCase();
    if (normalized.length === 0 || normalized.length % 2 !== 0) return null;
    if (!/^[0-9a-f]+$/.test(normalized)) return null;
    return normalized;
  }

  pubkeyToBytes(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    const normalizedHex = this.normalizeHex(trimmed);
    if (normalizedHex) {
      const bytes = this.hexToBytes(normalizedHex);
      if (bytes.length === 32) return bytes;
    }

    try {
      const decoded = bs58.decode(trimmed);
      return decoded.length === 32 ? decoded : null;
    } catch {
      return null;
    }
  }

  signatureToBytes(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    const normalizedHex = this.normalizeHex(trimmed);
    if (normalizedHex) {
      const bytes = this.hexToBytes(normalizedHex);
      if (bytes.length === 64) return bytes;
    }

    try {
      const decoded = bs58.decode(trimmed);
      return decoded.length === 64 ? decoded : null;
    } catch {
      return null;
    }
  }

  bytesToHex(bytes) {
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  hexToBytes(hex) {
    if (typeof hex !== 'string') return new Uint8Array();
    const normalized = this.normalizeHex(hex);
    if (!normalized) return new Uint8Array();
    if (normalized.length % 2) return new Uint8Array();

    const array = new Uint8Array(normalized.length / 2);
    for (let i = 0; i < array.length; i += 1) {
      const j = i * 2;
      array[i] = parseInt(normalized.substring(j, j + 2), 16);
    }

    return array;
  }
}




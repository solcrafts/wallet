import nacl from 'tweetnacl';
import bs58 from 'bs58';

function base64ToBytes(base64) {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

export class WorkerKeyringController {
  constructor() {
    this.secretKey = null;
    this.publicKey = null;
    this._solana = null;
  }

  async ensureSolana() {
    if (!globalThis.window) globalThis.window = globalThis;
    if (!this._solana) {
      this._solana = await import('@solana/web3.js');
    }
    return this._solana;
  }

  async importPrivateKey(privateKey) {
    const raw = (privateKey || '').trim();
    const decoded = bs58.decode(raw);
    if (!decoded || decoded.length === 0) {
      throw new Error('Invalid private key');
    }

    if (decoded.length === 64) {
      this.secretKey = decoded;
      this.publicKey = decoded.slice(32);
      return this.getAddress();
    }

    if (decoded.length === 32) {
      const pair = nacl.sign.keyPair.fromSeed(decoded);
      this.secretKey = pair.secretKey;
      this.publicKey = pair.publicKey;
      return this.getAddress();
    }

    throw new Error('Invalid private key length');
  }

  async load() {
    try {
      const result = await chrome.storage.local.get('agipocket_vault');
      if (!result.agipocket_vault) return false;

      const data = JSON.parse(result.agipocket_vault);
      if (!data.privateKey) return false;

      await this.importPrivateKey(data.privateKey);
      return true;
    } catch (error) {
      console.warn('[WorkerKeyring] Failed to load local vault:', error);
      return false;
    }
  }

  getAddress() {
    return this.publicKey ? bs58.encode(this.publicKey) : null;
  }

  async signMessage(message) {
    if (!this.secretKey) throw new Error('Wallet not initialized');
    const messageBytes = new TextEncoder().encode(String(message));
    const signature = nacl.sign.detached(messageBytes, this.secretKey);
    return bs58.encode(signature);
  }

  async signTransaction(serializedTxBase64) {
    if (!this.secretKey) throw new Error('Wallet not initialized');

    const { Keypair, VersionedTransaction, Transaction } = await this.ensureSolana();
    const keypair = Keypair.fromSecretKey(this.secretKey);
    const txBytes = base64ToBytes(serializedTxBase64);

    try {
      const tx = VersionedTransaction.deserialize(txBytes);
      tx.sign([keypair]);
      return bytesToBase64(tx.serialize());
    } catch {
      const tx = Transaction.from(txBytes);
      tx.partialSign(keypair);
      return bytesToBase64(tx.serialize({ requireAllSignatures: false }));
    }
  }

  async sendSerializedTransaction(serializedTxBase64, connection, options = {}) {
    if (!connection) throw new Error('RPC connection required');

    const signedBase64 = await this.signTransaction(serializedTxBase64);
    const raw = base64ToBytes(signedBase64);

    const signature = await connection.sendRawTransaction(raw, {
      skipPreflight: Boolean(options.skipPreflight),
      maxRetries: typeof options.maxRetries === 'number' ? options.maxRetries : 3
    });

    await connection.confirmTransaction(signature, 'confirmed');
    return signature;
  }
}

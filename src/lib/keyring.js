import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist as englishWordlist } from '@scure/bip39/wordlists/english';
import { hmac } from '@noble/hashes/hmac';
import { sha512 } from '@noble/hashes/sha2';
import { concatBytes, utf8ToBytes } from '@noble/hashes/utils';

const DERIVATION_PATH = "m/44'/501'/0'/0'";
const HARDENED_OFFSET = 0x80000000;

function isNumericArrayString(value) {
  return typeof value === 'string' && value.trim().startsWith('[') && value.trim().endsWith(']');
}

function ensureUint8Array(secret) {
  if (secret instanceof Uint8Array) return secret;
  if (Array.isArray(secret)) return Uint8Array.from(secret);
  return new Uint8Array(secret);
}

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

function parseDerivationPath(path) {
  if (typeof path !== 'string' || path.length === 0) {
    throw new Error('Invalid derivation path');
  }

  const parts = path.split('/');
  if (parts[0] !== 'm') {
    throw new Error('Derivation path must start with m');
  }

  return parts.slice(1).map((part) => {
    if (!part.endsWith("'")) {
      throw new Error('Only hardened derivation path is supported');
    }

    const index = Number(part.slice(0, -1));
    if (!Number.isInteger(index) || index < 0 || index > 0x7fffffff) {
      throw new Error('Invalid derivation index');
    }

    return index + HARDENED_OFFSET;
  });
}

function serializeIndex(index) {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, index, false);
  return out;
}

function deriveSlip10Ed25519Seed(seed, derivationPath = DERIVATION_PATH) {
  const path = parseDerivationPath(derivationPath);
  let digest = hmac(sha512, utf8ToBytes('ed25519 seed'), seed);
  let key = digest.slice(0, 32);
  let chainCode = digest.slice(32);

  for (const index of path) {
    const data = concatBytes(new Uint8Array([0]), key, serializeIndex(index));
    digest = hmac(sha512, chainCode, data);
    key = digest.slice(0, 32);
    chainCode = digest.slice(32);
  }

  return key;
}

export class KeyringController {
  constructor() {
    this.keypair = null;
    this.mnemonic = null;
    this._solana = null;
  }

  async ensureSolana() {
    if (!this._solana) {
      this._solana = await import('@solana/web3.js');
    }
    return this._solana;
  }

  static createMnemonic() {
    return generateMnemonic(englishWordlist, 128);
  }

  async fromSeed(seed32) {
    const { Keypair } = await this.ensureSolana();
    const pair = nacl.sign.keyPair.fromSeed(seed32);
    return Keypair.fromSecretKey(pair.secretKey);
  }

  async importMnemonic(mnemonic) {
    const normalized = String(mnemonic || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!validateMnemonic(normalized, englishWordlist)) {
      throw new Error('Invalid mnemonic');
    }

    const seed = ensureUint8Array(mnemonicToSeedSync(normalized));
    const derivedSeed = deriveSlip10Ed25519Seed(seed, DERIVATION_PATH);
    this.keypair = await this.fromSeed(derivedSeed);
    this.mnemonic = normalized;
    return this.getAddress();
  }

  async importPrivateKey(privateKey) {
    try {
      let secret;
      const raw = (privateKey || '').trim();

      if (isNumericArrayString(raw)) {
        secret = ensureUint8Array(JSON.parse(raw));
      } else {
        secret = ensureUint8Array(bs58.decode(raw));
      }

      if (secret.length === 32) {
        this.keypair = await this.fromSeed(secret);
      } else if (secret.length === 64) {
        const { Keypair } = await this.ensureSolana();
        this.keypair = Keypair.fromSecretKey(secret);
      } else {
        throw new Error('Private key must be 32-byte seed or 64-byte secret key');
      }

      this.mnemonic = null;
      return this.getAddress();
    } catch (e) {
      throw new Error(`Invalid private key: ${e.message}`);
    }
  }

  getAddress() {
    return this.keypair ? this.keypair.publicKey.toBase58() : null;
  }

  getPrivateKeyBase58() {
    return this.keypair ? bs58.encode(this.keypair.secretKey) : '';
  }

  getPrivateKeySeedBase58() {
    if (!this.keypair) return '';
    return bs58.encode(this.keypair.secretKey.slice(0, 32));
  }

  getPrivateKeyJsonArray() {
    if (!this.keypair) return '[]';
    return JSON.stringify(Array.from(this.keypair.secretKey));
  }

  async getAddressFromPrivateKey(privateKey) {
    const raw = String(privateKey || '').trim();
    if (!raw) throw new Error('Private key is empty');

    const normalized = isNumericArrayString(raw) ? JSON.stringify(JSON.parse(raw)) : raw;
    const clone = new KeyringController();
    await clone.importPrivateKey(normalized);
    return clone.getAddress();
  }

  getPublicKeyBytes() {
    return this.keypair ? this.keypair.publicKey.toBytes() : new Uint8Array();
  }

  getSecretKeyBytes() {
    return this.keypair ? this.keypair.secretKey : new Uint8Array();
  }

  async signMessage(message) {
    if (!this.keypair) throw new Error('Wallet not initialized');
    const messageBytes = new TextEncoder().encode(String(message));
    const signature = nacl.sign.detached(messageBytes, this.keypair.secretKey);
    return bs58.encode(signature);
  }

  async signTransaction(serializedTxBase64) {
    if (!this.keypair) throw new Error('Wallet not initialized');

    const { VersionedTransaction, Transaction } = await this.ensureSolana();
    const txBytes = base64ToBytes(serializedTxBase64);

    try {
      const tx = VersionedTransaction.deserialize(txBytes);
      tx.sign([this.keypair]);
      return bytesToBase64(tx.serialize());
    } catch {
      const tx = Transaction.from(txBytes);
      tx.partialSign(this.keypair);
      return bytesToBase64(tx.serialize({ requireAllSignatures: false }));
    }
  }

  async sendSerializedTransaction(serializedTxBase64, connection, options = {}) {
    if (!this.keypair) throw new Error('Wallet not initialized');
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

  async save() {
    if (!this.keypair) throw new Error('Wallet not initialized');

    const data = {
      mnemonic: this.mnemonic,
      privateKey: this.getPrivateKeyBase58(),
      address: this.getAddress()
    };

    await chrome.storage.local.set({
      agipocket_vault: JSON.stringify(data),
      agipocket_public_address: data.address
    });
  }

  async load() {
    try {
      const result = await chrome.storage.local.get('agipocket_vault');
      if (!result.agipocket_vault) return false;

      const data = JSON.parse(result.agipocket_vault);
      if (!data.privateKey) return false;

      await this.importPrivateKey(data.privateKey);
      this.mnemonic = data.mnemonic || null;
      return true;
    } catch (error) {
      console.warn('[Keyring] Failed to load local vault, fallback to onboarding:', error);
      return false;
    }
  }
}

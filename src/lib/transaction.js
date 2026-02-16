import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';

export class TransactionController {
  constructor(keyring, provider) {
    this.keyring = keyring;
    this.provider = provider;
  }

  setProvider(provider) {
    this.provider = provider;
  }

  async getBalance() {
    const address = this.keyring.getAddress();
    if (!address || !this.provider) return '0';

    try {
      const lamports = await this.provider.getBalance(new PublicKey(address));
      return (lamports / LAMPORTS_PER_SOL).toString();
    } catch (e) {
      console.error('Failed to get balance:', e);
      return '0';
    }
  }

  async sendTransaction(to, amount) {
    if (!this.keyring.keypair) throw new Error('Wallet not initialized');
    if (!this.provider) throw new Error('Provider not set');

    const sender = this.keyring.keypair.publicKey;
    const recipient = new PublicKey(to);
    const lamports = Math.round(Number(amount) * LAMPORTS_PER_SOL);
    if (!Number.isFinite(lamports) || lamports <= 0) {
      throw new Error('Invalid amount');
    }

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: sender,
        toPubkey: recipient,
        lamports
      })
    );

    const latest = await this.provider.getLatestBlockhash('finalized');
    tx.recentBlockhash = latest.blockhash;
    tx.feePayer = sender;
    tx.sign(this.keyring.keypair);

    const signature = await this.provider.sendRawTransaction(tx.serialize());
    await this.provider.confirmTransaction({ signature, ...latest }, 'confirmed');

    return { hash: signature };
  }
}

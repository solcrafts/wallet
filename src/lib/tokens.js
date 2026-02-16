import { PublicKey } from '@solana/web3.js';

const DEFAULT_TOKENS = {
  solana_mainnet: [],
  solana_devnet: [],
  solana_testnet: []
};

export class TokenController {
  constructor() {
    this.tokens = { ...DEFAULT_TOKENS };
  }

  async load() {
    const data = await chrome.storage.local.get('agipocket_tokens');
    if (data.agipocket_tokens) {
      this.tokens = JSON.parse(data.agipocket_tokens);
    }

    for (const key of Object.keys(DEFAULT_TOKENS)) {
      if (!this.tokens[key]) this.tokens[key] = [];
    }
  }

  async save() {
    await chrome.storage.local.set({ agipocket_tokens: JSON.stringify(this.tokens) });
  }

  async addToken(networkKey, mintAddress) {
    if (!this.tokens[networkKey]) this.tokens[networkKey] = [];

    const mintPk = new PublicKey(mintAddress);
    const normalized = mintPk.toBase58();

    const exists = this.tokens[networkKey].find((token) => token.address === normalized);
    if (exists) throw new Error('Token already added');

    this.tokens[networkKey].push({
      address: normalized,
      symbol: `SPL-${normalized.slice(0, 4)}`
    });

    await this.save();
    return `SPL-${normalized.slice(0, 4)}`;
  }

  getTokens(networkKey) {
    return this.tokens[networkKey] || [];
  }

  async getTokenBalances(networkKey, walletAddress, connection) {
    const owner = new PublicKey(walletAddress);
    const response = await connection.getParsedTokenAccountsByOwner(owner, {
      programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
    });

    const accountMap = new Map();
    response.value.forEach(({ account }) => {
      const info = account.data.parsed.info;
      accountMap.set(info.mint, info.tokenAmount.uiAmountString || '0');
    });

    const balances = {};
    const tokens = this.getTokens(networkKey);
    tokens.forEach((token) => {
      balances[token.address] = accountMap.get(token.address) || '0';
    });

    return balances;
  }
}

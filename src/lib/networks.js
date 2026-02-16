const CHAIN_ID_ALIASES = {
  mainnet: ['mainnet', 'mainnet-beta', 'solana_mainnet', '101'],
  devnet: ['devnet', 'solana_devnet', '103'],
  testnet: ['testnet', 'solana_testnet', '102']
};

function normalizeChainId(value) {
  if (value === null || value === undefined) return null;

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;

  for (const [canonical, aliases] of Object.entries(CHAIN_ID_ALIASES)) {
    if (aliases.includes(normalized)) return canonical;
  }

  return null;
}

const DEFAULT_NETWORKS = {
  solana_mainnet: {
    chainId: 'mainnet',
    name: 'Solana Mainnet',
    rpcUrl: 'https://mainnet.helius-rpc.com/?api-key=566738fd-3d30-4f94-aea1-39ec28ea9598',
    symbol: 'SOL',
    blockExplorer: 'https://solscan.io'
  },
  solana_devnet: {
    chainId: 'devnet',
    name: 'Solana Devnet',
    rpcUrl: 'https://api.devnet.solana.com',
    symbol: 'SOL',
    blockExplorer: 'https://solscan.io'
  },
  solana_testnet: {
    chainId: 'testnet',
    name: 'Solana Testnet',
    rpcUrl: 'https://api.testnet.solana.com',
    symbol: 'SOL',
    blockExplorer: 'https://solscan.io'
  }
};
const LEGACY_MAINNET_RPC = 'https://api.mainnet-beta.solana.com';

export class NetworkController {
  constructor() {
    this.networks = { ...DEFAULT_NETWORKS };
    this._solana = null;
  }

  async ensureSolana() {
    if (!globalThis.window) globalThis.window = globalThis;
    if (!this._solana) {
      this._solana = await import('@solana/web3.js');
    }
    return this._solana;
  }

  async load() {
    const data = await chrome.storage.local.get('agipocket_networks');
    if (!data.agipocket_networks) {
      this.normalizeNetworks();
      return;
    }

    const stored = JSON.parse(data.agipocket_networks);
    this.networks = { ...stored };

    for (const key of Object.keys(DEFAULT_NETWORKS)) {
      this.networks[key] = { ...DEFAULT_NETWORKS[key], ...(this.networks[key] || {}) };
    }

    if (this.networks.solana_mainnet?.rpcUrl === LEGACY_MAINNET_RPC) {
      this.networks.solana_mainnet.rpcUrl = DEFAULT_NETWORKS.solana_mainnet.rpcUrl;
    }

    this.normalizeNetworks();
  }

  async save() {
    await chrome.storage.local.set({ agipocket_networks: JSON.stringify(this.networks) });
  }

  getNetworkByChainId(chainId) {
    const key = this.getNetworkKeyByChainId(chainId);
    return key ? this.networks[key] : null;
  }

  getNetworkKeyByChainId(chainId) {
    const normalized = normalizeChainId(chainId);
    if (!normalized) return null;

    const entry = Object.entries(this.networks).find(
      ([, network]) => normalizeChainId(network.chainId) === normalized
    );

    return entry?.[0] || null;
  }

  getNetwork(key) {
    return this.networks[key] || null;
  }

  getAllNetworks() {
    return this.networks;
  }

  getDefaultNetworkKey() {
    return 'solana_mainnet';
  }

  async getProvider(key) {
    const network = this.networks[key];
    if (!network) throw new Error('Network not supported');
    const { Connection } = await this.ensureSolana();
    return new Connection(network.rpcUrl, 'confirmed');
  }

  async addCustomRpc(key, url) {
    if (!this.networks[key]) throw new Error('Network not found');

    try {
      const { Connection } = await this.ensureSolana();
      const connection = new Connection(url, 'confirmed');
      await connection.getLatestBlockhash('processed');
      this.networks[key].rpcUrl = url;
      await this.save();
    } catch {
      throw new Error('Invalid RPC URL');
    }
  }

  normalizeNetworks() {
    Object.keys(this.networks).forEach((key) => {
      const existing = this.networks[key] || {};
      const fallback = DEFAULT_NETWORKS[key]?.chainId || null;
      const normalizedChainId = normalizeChainId(existing.chainId) || fallback;
      this.networks[key] = {
        ...existing,
        ...(normalizedChainId ? { chainId: normalizedChainId } : {})
      };
    });
  }
}

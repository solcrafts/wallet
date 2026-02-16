export const AGI_STORAGE_KEYS = {
  VAULT: 'agipocket_vault',
  PUBLIC_ADDRESS: 'agipocket_public_address',
  RELAY_URL: 'agipocket_relay_url',
  NETWORK: 'agipocket_network',
  NETWORKS: 'agipocket_networks',
  TOKENS: 'agipocket_tokens',
  WHITELIST: 'agipocket_whitelist',
  AUTO_CONFIRM: 'agipocket_auto_confirm',
  PENDING_REQUEST: 'agipocket_pending_request'
};

const LEGACY_KEYS = [
  'vault',
  'publicAddress',
  'relayUrl',
  'network',
  'networks',
  'tokens',
  'whitelist',
  'autoConfirm',
  'pendingRequest'
];

export async function cleanupLegacyStorage() {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all || {});

  const legacyDynamic = keys.filter((k) => k.startsWith('cache_') || k.startsWith('nonce_'));
  const removable = [...LEGACY_KEYS, ...legacyDynamic].filter((k) => keys.includes(k));

  if (removable.length > 0) {
    await chrome.storage.local.remove(removable);
  }
}

export function agiCacheKey(network, address) {
  return `agipocket_cache_${network}_${address}`;
}

export function agiNonceKey(pubkey) {
  return `agipocket_nonce_${pubkey}`;
}

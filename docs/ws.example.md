# WebSocket Relay Protcol Specification (Secure)

The Meme Wallet Extension supports a "Relay" mode where it connects to a specified WebSocket URL to receive remote commands.
**Security Update**: All messages must be signed by a trusted Ed25519 key.

## 1. Connection
The wallet initiates the connection to the `Relay URL` configured in Settings.

## 2. Request Structure (Sender -> Wallet)
Every message sent to the wallet MUST follow this authenticated envelope format:

```json
{
  "protocol": "ed25519/v1",
  "data": {
    "nonce": 123,           // Integer, must be > previous nonce received from this pubkey
    "timestamp": 167890000, // Optional: timestamp to prevent long-replay if nonce state is lost
    "method": "sign_transaction",
    "params": [...]
  },
  "auth": {
    "pubkey": "aad3b...",   // Hex string of the Ed25519 public key
    "signature": "..."      // Hex string of Ed25519(JSON.stringify(data))
  }
}
```

### Validation Rules
1. **Whitelist**: The wallet will verify if `auth.pubkey` exists in its local "Trusted Apps" whitelist.
2. **Signature**: Use `auth.pubkey` to verify `auth.signature` against the serialized `data` object (canonical JSON needed or raw string logic).
3. **Nonce**: `data.nonce` must be strictly greater than the last processed nonce for this `pubkey`.

## 3. Response Structure (Wallet -> Sender)
The wallet acknowledges execution with a signed response, proving it was the holder of the Ethereum private key who executed it.

```json
{
  "protocol": "eth/v1",
  "data": {
    "nonce": 123,           // Echoes the request nonce
    "id": 1,                // Request ID if applicable
    "result": "...",        // The result of the operation
    "error": null
  },
  "auth": {
    "address": "0xWalletAddress...", // The Ethereum address of the wallet
    "signature": "0x..."             // Ethereum Signature (EIP-191) of JSON.stringify(data)
  }
}
```

## 4. Methods

### `get_address`
*Request params*: `[]`
*Response result*: `"0xWalletAddress..."`

### `sign_transaction`
*Request params*: `[{ "to": "...", "value": "...", "data": "..." }]`
*Response result*: `"0xSignedTxHash..."`

### `sign_message`
*Request params*: `["Message text"]`
*Response result*: `"0xSig..."`

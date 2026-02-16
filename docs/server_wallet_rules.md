# WebSocket Wallet Authentication Rules (Strict)

Aligned with `wallet_require.md`.

## 1. Auth Handshake (Wallet -> Server)

**Trigger**: Immediately after WebSocket `onopen`.

### Payload Structure
```json
{
  "type": "wallet_auth",
  "payload": {
    "timestamp": 1715000000000, 
    "address": "0xMain...",       
    "publicKey": "0x..."         
  },
  "signature": "0x..."           // Ethereum Signature (EIP-191) of JSON.stringify(payload) using MAIN KEY
}
```

## 2. Signing Rules
- **Signer**: **Main Wallet Private Key**.
- **Persistence**: The Private Key MUST be retrieved from `chrome.storage.session` (unlocked state).
- **Behavior**: 
    - If Wallet is Locked (no session key): Do NOT connect (or disconnect).
    - If Wallet is Unlocked: Sign current timestamp and Connect.

## 3. Server Verification
1.  **Timestamp**: `abs(now - timestamp) < 30s`.
2.  **Signature**: Recover address from `signature`. Match `payload.address`.

## 4. Error Codes (Wallet -> Server)

When a request fails or is rejected by the user, the `error` field in the response MUST follow these codes:

-   **4001**: User Rejected Request (Classic EIP-1193).
-   **-32603**: Internal Error (Execution failed).
-   **-32601**: Method not found.

Example Rejection:
```json
{
  "nonce": 123,
  "id": 1,
  "error": "User rejected the request",
  "code": 4001,
  "result": null
}
```

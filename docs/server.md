# WebSocket Relay Server Specification

This document defines the requirements for a Relay Server that facilitates communication between the **Meme Wallet Extension** and external applications (DApps).

## 1. Overview
The server acts as a **message broker**. It routed authenticated JSON-RPC requests to Wallet Users.

## 2. Relay Protocol

### 2.1 Request Format (Sender -> Server)
Senders MUST wrap their payload in an **Authenticated Envelope**.

```json
{
  "target": "0xTargetWalletAddress",
  "payload": {
    "protocol": "ed25519/v1",
    "data": {
      "nonce": 123,
      "method": "...",
      "params": [...]
    },
    "auth": {
      "pubkey": "ed25519_pubkey_hex",
      "signature": "ed25519_sig_hex"
    }
  }
}
```

### 2.2 Forwarding Logic (Server)
1. **Routing**: Server looks up the socket for `target` address.
2. **Passthrough**:
   - The Server **DOES NOT** verify the Ed25519 signature (that is the Wallet's job).
   - The Server simply forwards the `payload` object to the target wallet.
3. **Error Handling**:
   - If `target` is not connected, return error to Sender.

### 2.3 Response Authorization (Wallet -> Server -> Sender)
Wallets MUST sign their responses to prove origin.

1. **Wallet Response**:
   ```json
   {
     "protocol": "eth/v1",
     "data": {
        "nonce": 123,
        "result": "..."
     },
     "auth": {
        "address": "0xWalletAddress",
        "signature": "0xEthSignature..."
     }
   }
   ```
2. **Server Action**: Forward the response back to the original Sender.

## 3. Security Requirements
- **Replay Protection**: The Server is not responsible for replay protection; the Wallet handles nonces.
- **Privacy**: The Server sees the `target` address and the payload content.

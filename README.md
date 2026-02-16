# AGIPOCKET Wallet (Chrome Extension)

AGIPOCKET is a Solana wallet extension for agent workflows with human-in-the-loop confirmation.

![AGIPOCKET Wallet Banner](./src/res/banner.png)

## Highlights

- Solana native keypair model (ed25519)
- Message and transaction signing via TweetNaCl
- Relay protocol for agent-driven requests with manual confirmation popup
- Full request/response protocol aligned to `ed25519/v1`

## Supported Methods

- `get_address`
- `sign_message`
- `sign_transaction`
- `send_transaction`

## Transaction Params (Solana)

For `sign_transaction` and `send_transaction`, use:

```json
{
  "chainId": "devnet",
  "transaction": "<base64 serialized solana transaction>",
  "skipPreflight": false,
  "maxRetries": 3
}
```

Supported `chainId` values:

- `mainnet`
- `devnet`
- `testnet`

## Private Key Export Formats

Settings now provides three export formats for cross-wallet compatibility:

- Base58 64-byte secret key (`Keypair.secretKey`)
- Base58 32-byte seed (`secretKey[0..31]`)
- JSON array 64-byte secret key (Solana CLI style)

If another wallet imports to a different address, try a different format according to that wallet's import spec.

## Relay Packet Format

- Sender -> Wallet: `protocol: "ed25519/v1"`
- Wallet -> Relay/Sender: `protocol: "ed25519/v1"`

## Local Run

```bash
npm install
npm run build
```

Load `dist/` as an unpacked extension in Chrome.

# Confirmation Rejection Rules

## Error Codes (Wallet -> Server)

When a request (Transaction or signature) fails or is rejected by the user, the `error` field in the response MUST follow these codes:

-   **4001**: User Rejected Request (Classic EIP-1193).
-   **-32603**: Internal Error (Execution failed).
-   **-32601**: Method not found.

### Example Rejection Payload

```json
{
  "nonce": 123,
  "id": 1,
  "error": "User rejected the request",
  "code": 4001,
  "result": null
}
```

## Implementation Logic

1.  **Auto-Confirm Check**:
    -   If `Auto-Confirm` is **OFF** in Settings, the Wallet intercepts the request.
2.  **Popup Prompt**:
    -   A window opens showing transaction details.
3.  **User Action**:
    -   **Confirm**: Wallet proceeds to sign/broadcast.
    -   **Reject**: Wallet sends the above **4001** error response to the Relay Server.

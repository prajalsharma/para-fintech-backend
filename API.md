# API Specification

## Base URL
```
http://localhost:3000/api
```

## Authentication

All endpoints except `/auth/*` require a valid Supabase JWT token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

The token is obtained from `/auth/login` or `/auth/signup` and should be included in subsequent requests.

---

## Endpoint Summary

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/auth/signup` | No | Register new user and create wallet |
| POST | `/auth/login` | No | Login existing user |
| GET | `/wallet` | Yes | Get wallet details and balance |
| GET | `/wallet/status` | Yes | Quick wallet status check |
| POST | `/transaction/send` | Yes | Send crypto transaction |
| GET | `/transaction/:hash` | No | Check transaction status |
| GET | `/health` | No | Server health check |

---

## Detailed Endpoints

### 1. User Registration & Wallet Provisioning

#### `POST /auth/signup`

Create a new user account and automatically provision an EVM wallet.

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "SecurePass123!"
  }'
```

**Response:** (201 Created)
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "alice@example.com"
  },
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer"
  },
  "wallet": {
    "id": "wal_1234567890",
    "status": "creating",
    "address": null,
    "message": "Wallet is being created. Poll the /wallet endpoint to check status."
  }
}
```

**Status Codes:**
- `201 Created`: User created and wallet provisioned
- `400 Bad Request`: Missing email or password
- `500 Internal Server Error`: Para or database error

**Notes:**
- Wallet creation is asynchronous; `status` will be "creating"
- Poll `/wallet` endpoint repeatedly until `status` becomes "ready" and `address` is populated
- Token should be stored securely on client (localStorage/sessionStorage for web)

---

### 2. User Login

#### `POST /auth/login`

Authenticate an existing user and obtain JWT token.

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "SecurePass123!"
  }'
```

**Response:** (200 OK)
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "alice@example.com"
  },
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer"
  }
}
```

**Status Codes:**
- `200 OK`: Login successful
- `400 Bad Request`: Missing credentials
- `401 Unauthorized`: Invalid email/password
- `500 Internal Server Error`: Server error

**Notes:**
- No wallet is created on login (it was created at signup)
- Use the returned `access_token` for all subsequent authenticated requests
- Token has expiration; refresh if needed using Supabase client library

---

### 3. View Wallet Details

#### `GET /wallet`

Retrieve full wallet details including address, status, and current ETH balance.

**Request:**
```bash
curl -X GET http://localhost:3000/api/wallet \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:** (200 OK) - After wallet is ready
```json
{
  "id": "wal_1234567890",
  "type": "EVM",
  "status": "ready",
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "publicKey": "0xabc123def456...",
  "balance": {
    "wei": "1500000000000000000",
    "eth": "1.5"
  },
  "createdAt": "2024-01-01T00:00:00Z",
  "message": "Wallet is ready for transactions!"
}
```

**Response:** (200 OK) - While wallet is creating
```json
{
  "id": "wal_1234567890",
  "type": "EVM",
  "status": "creating",
  "address": null,
  "publicKey": null,
  "balance": null,
  "createdAt": "2024-01-01T00:00:00Z",
  "message": "Wallet is still being created. MPC key generation in progress."
}
```

**Status Codes:**
- `200 OK`: Wallet found
- `401 Unauthorized`: Invalid or missing token
- `404 Not Found`: Wallet not found for user
- `500 Internal Server Error`: Para or RPC error

**Field Explanations:**
- `status`: "creating" or "ready" - check before using for transactions
- `balance.wei`: Balance in wei (smallest Ethereum unit)
- `balance.eth`: Balance in ETH (1 ETH = 10^18 wei)
- `publicKey`: Public key for wallet (used by Para's MPC scheme)

---

### 4. Quick Wallet Status Check

#### `GET /wallet/status`

Lightweight status check without querying balance (saves RPC calls).

**Request:**
```bash
curl -X GET http://localhost:3000/api/wallet/status \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:** (200 OK)
```json
{
  "status": "ready",
  "address": "0x1234567890abcdef1234567890abcdef12345678"
}
```

**Use Case:**
- Polling after signup to detect when wallet is ready
- Check before initiating transactions
- Avoid the full `/wallet` call when you only need status

---

### 5. Send Cryptocurrency

#### `POST /transaction/send`

Initiate a crypto transfer from user's wallet to recipient.

**Request:**
```bash
curl -X POST http://localhost:3000/api/transaction/send \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "to": "0x8ba1f109551bd432803012645ac136ddd64dba72",
    "amount": "0.5",
    "gasLimit": "21000",
    "maxFeePerGas": "50000000000",
    "maxPriorityFeePerGas": "2000000000"
  }'
```

**Request Fields:**
- `to` (required): Recipient Ethereum address (checksummed or lowercase)
- `amount` (required): Amount to send in ETH (string to avoid floating point issues)
- `gasLimit` (optional): Gas limit; defaults to 21000 for native transfers
- `maxFeePerGas` (optional): Max fee per gas in wei; fetched from network if not provided
- `maxPriorityFeePerGas` (optional): Priority fee in wei; fetched from network if not provided

**Response:** (201 Created)
```json
{
  "transactionHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "status": "pending",
  "from": "0x1234567890abcdef1234567890abcdef12345678",
  "to": "0x8ba1f109551bd432803012645ac136ddd64dba72",
  "value": "0.5",
  "message": "Transaction broadcasted. Monitor the hash on Sepolia block explorer."
}
```

**Status Codes:**
- `201 Created`: Transaction successfully broadcasted
- `400 Bad Request`: Invalid address or missing fields
- `401 Unauthorized`: Invalid token
- `404 Not Found`: Wallet not found
- `500 Internal Server Error`: Para signing error or RPC error

**Execution Flow:**
1. JWT verified
2. User's wallet fetched (must be status="ready")
3. Transaction parameters built (nonce, gas prices)
4. Data hashed
5. Para signs hash using MPC (never exposes full key)
6. Signed transaction serialized
7. Broadcast to Sepolia RPC
8. Transaction hash returned

**Important Notes:**
- Transaction is "pending" immediately; check status with `/transaction/:hash` later
- Para signing is non-custodial: your backend holds API key but private key never exists in one place
- Ensure wallet has sufficient balance and ETH for gas
- Gas prices on Sepolia change frequently; provide custom fees for predictability

**Example: Manual Gas Price Estimation**
```bash
# Get current Sepolia gas prices
curl https://sepolia.infura.io/v3/YOUR-PROJECT-ID \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_gasPrice","params":[],"id":1}'

# Use returned gasPrice as a base for maxFeePerGas
```

---

### 6. Check Transaction Status

#### `GET /transaction/:txHash`

Retrieve transaction details and confirmation status from blockchain.

**Request:**
```bash
curl -X GET http://localhost:3000/api/transaction/0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

**Response:** (200 OK)
```json
{
  "transactionHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "blockNumber": 4567890,
  "blockHash": "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
  "status": "success",
  "gasUsed": "21000",
  "gasPrice": "50000000000",
  "from": "0x1234567890abcdef1234567890abcdef12345678",
  "to": "0x8ba1f109551bd432803012645ac136ddd64dba72",
  "value": "500000000000000000"
}
```

**Status Codes:**
- `200 OK`: Transaction found and mined
- `404 Not Found`: Transaction not yet mined or invalid hash
- `500 Internal Server Error`: RPC error

**Field Explanations:**
- `status`: "success" (status code 1) or "failed" (status code 0)
- `value`: Amount transferred in wei
- `gasUsed`: Actual gas consumed
- `blockNumber`: Block in which transaction was mined

**Polling Strategy:**
```javascript
// Poll every 5 seconds until mined
const pollTransaction = async (txHash, maxAttempts = 60) => {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`/api/transaction/${txHash}`);
      if (response.ok) {
        const tx = await response.json();
        console.log("Transaction confirmed:", tx.status);
        return tx;
      }
    } catch (e) {
      console.log("Still pending...");
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error("Transaction not confirmed");
};
```

---

### 7. Health Check

#### `GET /health`

Simple endpoint to verify server is running.

**Request:**
```bash
curl http://localhost:3000/health
```

**Response:** (200 OK)
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

---

## Error Handling

All error responses follow this format:

```json
{
  "error": "Error Type",
  "message": "Human-readable error description"
}
```

**Common Error Codes:**

| HTTP Code | Error Type | Cause |
|-----------|-----------|-------|
| 400 | Bad Request | Invalid input (missing fields, malformed JSON) |
| 401 | Unauthorized | Missing/invalid JWT token |
| 404 | Not Found | User/wallet/transaction not found |
| 409 | Conflict | Wallet already exists (on signup) |
| 500 | Internal Server Error | Para API error, database error, or RPC error |

---

## Rate Limiting

Currently not enforced, but recommended for production:
- 100 requests per minute per user
- 10 transactions per minute per wallet
- Implement using middleware like `express-rate-limit`

---

## Versioning

API version: `v1` (in path: `/api/v1/*`)

Future breaking changes will increment version. Current implementation uses `/api/*` for simplicity.

---

## Webhook Events (Future)

Planned events to be delivered to client webhooks:
- `wallet.ready`: Wallet finished creating
- `transaction.confirmed`: Transaction confirmed with N blocks
- `wallet.balance.changed`: Balance updated (optional polling)

---

## Client SDK Recommendations

### TypeScript/JavaScript
```typescript
class ParaFintechClient {
  constructor(private baseUrl: string, private token?: string) {}

  async signup(email: string, password: string) {
    return fetch(`${this.baseUrl}/auth/signup`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }).then(r => r.json());
  }

  async getWallet() {
    return fetch(`${this.baseUrl}/wallet`, {
      headers: { Authorization: `Bearer ${this.token}` },
    }).then(r => r.json());
  }

  async sendTransaction(to: string, amount: string) {
    return fetch(`${this.baseUrl}/transaction/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to, amount }),
    }).then(r => r.json());
  }
}
```

---

## Testing Checklist

- [ ] Signup creates user and wallet
- [ ] Login returns valid JWT
- [ ] Protected endpoints reject invalid tokens
- [ ] Wallet status transitions from "creating" to "ready"
- [ ] Can send transaction with valid wallet
- [ ] Transaction status can be polled
- [ ] Gas price estimation works
- [ ] Error messages are informative
- [ ] Concurrent requests handled correctly

# Para Fintech Backend

A production-ready fintech backend that handles user authentication, wallet management, and blockchain transactions using **Supabase Auth**, **Para REST API**, and **Ethereum Sepolia**.

## Overview

This backend implements a simple yet secure flow:

1. **User signs up** → Supabase creates user account
2. **Wallet auto-provisioned** → Para creates EVM wallet via REST API
3. **User logs in** → Standard JWT authentication
4. **View wallet** → Get address, status, and balance
5. **Send crypto** → Non-custodial MPC signing via Para

## Key Architecture Decisions

### Non-Custodial Security
- **MPC (2-of-2) Key Scheme**: One key share held by Para's secure enclave, the other by user via WebAuthn/passkey
- **Private keys never assembled**: Full key never exists in a single location
- **Trust boundary**: Only authenticated users can initiate signing requests

### Minimal State Storage
- Backend stores **only** the mapping: `supabase_user_id → para_wallet_id`
- Wallet addresses, balances, and public keys fetched on-demand
- No private keys, API secrets, or sensitive data persisted locally

### API-First Design
- Stateless REST endpoints
- Clear separation of concerns (auth, wallet, transactions)
- Easy to test and integrate

## Stack

| Component | Technology | Purpose |
|-----------|-----------|----------|
| **Auth** | Supabase | User signup/login, JWT tokens |
| **Wallet** | Para REST API | Wallet creation, signing, MPC security |
| **Blockchain** | Ethers.js + Sepolia | Transaction building, balance queries |
| **Server** | Express + TypeScript | API routing and business logic |
| **Database** | Supabase PostgreSQL | User-wallet mappings |

## Setup

### Prerequisites

- Node.js 16+ and npm/yarn
- Supabase project (free tier works)
- Para API account with REST access
- Ethereum Sepolia RPC endpoint (Infura, Alchemy, etc.)

### Installation

1. **Clone and install**
   ```bash
   git clone https://github.com/prajalsharma/para-fintech-backend
   cd para-fintech-backend
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Create database table** (Supabase SQL Editor)
   ```sql
   CREATE TABLE IF NOT EXISTS user_wallets (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     supabase_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
     para_wallet_id TEXT NOT NULL UNIQUE,
     wallet_address TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   CREATE INDEX user_wallets_supabase_id ON user_wallets(supabase_id);
   CREATE INDEX user_wallets_para_wallet_id ON user_wallets(para_wallet_id);
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

   Server runs on `http://localhost:3000`

## API Reference

### Authentication

#### `POST /api/auth/signup`
Register new user and provision wallet.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secure-password"
}
```

**Response:** (201 Created)
```json
{
  "user": {
    "id": "uuid-here",
    "email": "user@example.com"
  },
  "session": {
    "access_token": "eyJhbGc...",
    "token_type": "Bearer"
  },
  "wallet": {
    "id": "para-wallet-id",
    "status": "creating",
    "address": null,
    "message": "Wallet is being created. Poll the /wallet endpoint to check status."
  }
}
```

**Notes:**
- Wallet creation is async (status: "creating")
- Poll `/api/wallet` endpoint to get address when ready
- Supabase JWT token included in session

---

#### `POST /api/auth/login`
Authenticate existing user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Response:** (200 OK)
```json
{
  "user": {
    "id": "uuid-here",
    "email": "user@example.com"
  },
  "session": {
    "access_token": "eyJhbGc...",
    "token_type": "Bearer"
  }
}
```

---

### Wallet Management

#### `GET /api/wallet`
Retrieve wallet details and current balance.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:** (200 OK)
```json
{
  "id": "para-wallet-id",
  "type": "EVM",
  "status": "ready",
  "address": "0x1234567890abcdef...",
  "publicKey": "0xabc...",
  "balance": {
    "wei": "1500000000000000000",
    "eth": "1.5"
  },
  "createdAt": "2024-01-01T00:00:00Z",
  "message": "Wallet is ready for transactions!"
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid token
- `404 Not Found`: Wallet not found for user

---

#### `GET /api/wallet/status`
Quick status check without balance query.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:** (200 OK)
```json
{
  "status": "ready",
  "address": "0x1234567890abcdef..."
}
```

---

### Transactions

#### `POST /api/transaction/send`
Send cryptocurrency from user's wallet.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request:**
```json
{
  "to": "0x8ba1f109551bd432803012645ac136ddd64dba72",
  "amount": "0.1",
  "gasLimit": "21000",
  "maxFeePerGas": "50000000000",
  "maxPriorityFeePerGas": "2000000000"
}
```

**Response:** (201 Created)
```json
{
  "transactionHash": "0xabc123...",
  "status": "pending",
  "from": "0x1234567890abcdef...",
  "to": "0x8ba1f109551bd432803012645ac136ddd64dba72",
  "value": "0.1",
  "message": "Transaction broadcasted. Monitor the hash on Sepolia block explorer."
}
```

**Field Explanations:**
- `amount`: ETH amount to send (string)
- `gasLimit`: Gas limit (optional, defaults to 21000)
- `maxFeePerGas`, `maxPriorityFeePerGas`: EIP-1559 fees (optional, fetched from network if not provided)

**Flow Under the Hood:**
1. Verify JWT token
2. Fetch wallet from Para (check status="ready")
3. Build unsigned EIP-1559 transaction
4. Hash transaction data
5. Call Para's `/sign-raw` endpoint
6. Serialize transaction with signature
7. Broadcast to Sepolia RPC
8. Return transaction hash

**Error Responses:**
- `400 Bad Request`: Invalid recipient address or amount
- `401 Unauthorized`: Invalid token
- `404 Not Found`: User or wallet not found
- `500 Internal Server Error`: Para signing failed or RPC error

---

#### `GET /api/transaction/:txHash`
Check transaction status on Sepolia.

**Response:** (200 OK)
```json
{
  "transactionHash": "0xabc123...",
  "blockNumber": 123456,
  "blockHash": "0xdef456...",
  "status": "success",
  "gasUsed": "21000",
  "gasPrice": "50000000000",
  "from": "0x1234567890abcdef...",
  "to": "0x8ba1f109551bd432803012645ac136ddd64dba72",
  "value": "100000000000000000"
}
```

**Notes:**
- Status can be "success" or "failed"
- If transaction not yet mined, returns 404
- Values are in wei (except for hashes)

---

## Security Considerations

### Trust Boundaries
1. **Client ↔ Backend**: Secured by Supabase JWTs
2. **Backend ↔ Para**: Secured by X-API-Key (never exposed to client)
3. **Backend ↔ Blockchain**: Public RPC, but signed transactions are verified by network

### Best Practices Implemented
- JWT verification on all protected endpoints
- Para API key stored in environment variables
- No private key storage (MPC security)
- Minimal database schema (only mappings)
- Error handling without exposing sensitive details

### Recommended Production Setup
- Enable IP allowlisting in Para dashboard for your backend servers
- Use Supabase RLS (Row Level Security) policies
- Implement rate limiting per user
- Monitor Para API usage and set spending limits
- Use hardware security modules (HSM) if available
- Rotate API keys periodically

## Development Experience Feedback

### ✅ What Works Well
- **Para REST API is intuitive**: Standard HTTP/JSON makes integration simple
- **Clear endpoint patterns**: `/wallets`, `/sign-raw` are self-documenting
- **Good documentation**: Para docs include examples and error codes
- **Stateless design**: Easy to scale horizontally

### ⚠️ Potential Footguns
1. **Wallet creation is async**: Must poll until status="ready" before signing
2. **One wallet per userIdentifier**: 409 Conflict errors if you forget this constraint
3. **No built-in balance endpoint**: Must use blockchain RPC (added to this implementation)
4. **Manual transaction serialization**: Must correctly format EIP-1559 transactions

### 💡 DevX Improvements
- Consider caching wallet addresses locally after first fetch
- Implement background polling for wallet readiness
- Add webhook support for transaction confirmations
- Create SDKs for common languages (Python, Go, etc.)
- Provide live testing sandbox in docs

## Testing

### Manual API Testing with cURL

**1. Signup**
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'
```

**2. Login**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'
```

**3. Get Wallet (replace TOKEN with actual JWT)**
```bash
curl -X GET http://localhost:3000/api/wallet \
  -H "Authorization: Bearer TOKEN"
```

**4. Send Transaction**
```bash
curl -X POST http://localhost:3000/api/transaction/send \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "0x8ba1f109551bd432803012645ac136ddd64dba72",
    "amount": "0.01"
  }'
```

## Deployment

### Option 1: Vercel (Recommended for Node.js)
```bash
npm i -g vercel
vercel
```

### Option 2: Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

### Option 3: Traditional VPS
```bash
npm run build
npm start
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `409 Conflict` on signup | User already exists or wallet already created for that user |
| Wallet status stuck on "creating" | Para's MPC key generation may take time; increase polling interval |
| Transaction fails with "wallet not ready" | Ensure wallet status is "ready" before sending (check `/wallet/status`) |
| Invalid signature | Ensure transaction is hashed correctly before passing to Para |
| Balance shows 0 | Check wallet address is correct; Sepolia testnet may need faucet funds |

## Roadmap

- [ ] Multi-chain support (Polygon, Base, etc.)
- [ ] Token transfers (ERC-20) in addition to native ETH
- [ ] Webhook notifications for transaction confirmations
- [ ] Rate limiting per user
- [ ] Admin dashboard for monitoring
- [ ] Client SDK (TypeScript/JavaScript)
- [ ] Batch transaction support

## License

MIT

## Support

For issues, questions, or feedback:
- Open a GitHub issue
- Check Para's docs: https://docs.getpara.com
- Supabase docs: https://supabase.com/docs

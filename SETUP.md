# Setup Guide

## Prerequisites

1. **Node.js** (v16+)
   ```bash
   node --version  # Should be v16 or higher
   ```

2. **npm or yarn**
   ```bash
   npm --version
   ```

3. **Supabase Account** (free tier works)
   - Sign up at https://supabase.com
   - Create a new project

4. **Para API Account**
   - Sign up at https://getpara.com
   - Generate API key from dashboard

5. **Ethereum RPC Endpoint**
   - Free tier: https://www.infura.io
   - Alternative: https://alchemy.com

---

## Step-by-Step Setup

### 1. Clone Repository

```bash
git clone https://github.com/prajalsharma/para-fintech-backend.git
cd para-fintech-backend
```

### 2. Install Dependencies

```bash
npm install
```

This installs:
- `express` - Web framework
- `@supabase/supabase-js` - Supabase SDK
- `ethers` - Ethereum library
- `axios` - HTTP client for Para API
- `typescript` - Language support

### 3. Get Supabase Credentials

1. Go to https://supabase.com and create a new project
2. Wait for project to initialize (5-10 minutes)
3. Go to **Settings** → **API** → **Project API keys**
4. Copy:
   - `Project URL` (SUPABASE_URL)
   - `anon public` key (SUPABASE_ANON_KEY)
   - `service_role` key (SUPABASE_SERVICE_ROLE_KEY)
5. Go to **Settings** → **API** → **JWT Settings**
6. Copy the JWT secret (SUPABASE_JWT_SECRET)

### 4. Get Para API Credentials

1. Create account at https://getpara.com
2. Go to **Dashboard** → **API Keys**
3. Generate new API key
4. Copy the key (PARA_API_KEY)

### 5. Get Ethereum RPC Endpoint

#### Option A: Infura (Recommended)

1. Sign up at https://www.infura.io
2. Create new project
3. Select **Sepolia** network
4. Copy the HTTP endpoint:
   ```
   https://sepolia.infura.io/v3/YOUR-PROJECT-ID
   ```

#### Option B: Alchemy

1. Sign up at https://alchemy.com
2. Create app on Sepolia network
3. Copy the HTTP endpoint

#### Option C: Public RPC (Free but slower)

```
https://sepolia-rpc.publicnode.com
```

### 6. Create Environment File

Copy the example file and fill in credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_JWT_SECRET=your-jwt-secret-here

# Para API Configuration
PARA_API_KEY=para_api_key_here
PARA_BASE_URL=https://api.getpara.com

# Ethereum Configuration
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your-project-id
SEPOLIA_CHAIN_ID=11155111

# Server Configuration
PORT=3000
NODE_ENV=development
```

**Do NOT commit `.env` file!** It's already in `.gitignore`

### 7. Create Supabase Database Table

1. In Supabase dashboard, go to **SQL Editor**
2. Create new query and paste:

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

3. Click **Run** button

### 8. Start Development Server

```bash
npm run dev
```

You should see:
```
✓ Server running on http://localhost:3000
✓ Environment: development

Available endpoints:
  POST   /api/auth/signup         - Register new user & create wallet
  POST   /api/auth/login          - Login existing user
  GET    /api/wallet              - View wallet details & balance
  GET    /api/wallet/status       - Quick wallet status check
  POST   /api/transaction/send    - Send crypto transaction
  GET    /api/transaction/:hash   - Check transaction status
  GET    /health                  - Health check
```

### 9. Test Health Endpoint

In another terminal:

```bash
curl http://localhost:3000/health
```

Should return:
```json
{"status":"ok","timestamp":"2024-01-01T12:00:00.000Z"}
```

---

## Testing the Full Flow

### 1. Signup (Create User & Wallet)

```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'
```

Save the `access_token` from response.

**Response:**
```json
{
  "user": {
    "id": "uuid-here",
    "email": "test@example.com"
  },
  "session": {
    "access_token": "eyJhbGc...",
    "token_type": "Bearer"
  },
  "wallet": {
    "id": "wal_...",
    "status": "creating",
    "address": null
  }
}
```

### 2. Poll Wallet Status

Wallet creation takes 10-30 seconds. Poll until ready:

```bash
TOKEN="your-access-token-here"

curl -X GET http://localhost:3000/api/wallet/status \
  -H "Authorization: Bearer $TOKEN"
```

Keep running until:
```json
{
  "status": "ready",
  "address": "0x1234567890abcdef..."
}
```

### 3. Get Wallet Details

```bash
TOKEN="your-access-token-here"

curl -X GET http://localhost:3000/api/wallet \
  -H "Authorization: Bearer $TOKEN"
```

Response:
```json
{
  "id": "wal_...",
  "status": "ready",
  "address": "0x1234567890abcdef...",
  "balance": {
    "wei": "0",
    "eth": "0"
  }
}
```

### 4. Fund Wallet with Testnet ETH

Your wallet address has 0 ETH. Get testnet funds:

1. Go to https://sepoliafaucet.com
2. Paste your wallet address
3. Click "Send Sepolia ETH"
4. Wait 10-60 seconds
5. Check balance again with `/api/wallet`

### 5. Send Transaction

After funding, send 0.001 ETH to another address:

```bash
TOKEN="your-access-token-here"

curl -X POST http://localhost:3000/api/transaction/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "0x8ba1f109551bd432803012645ac136ddd64dba72",
    "amount": "0.001"
  }'
```

Response:
```json
{
  "transactionHash": "0x1234567890abcdef...",
  "status": "pending",
  "from": "0x...",
  "to": "0x8ba1f109551bd432803012645ac136ddd64dba72",
  "value": "0.001"
}
```

### 6. Check Transaction Status

Replace TXHASH with the hash from step 5:

```bash
TXHASH="0x1234567890abcdef..."

curl -X GET http://localhost:3000/api/transaction/$TXHASH
```

Will return 404 while pending, then details once mined:

```json
{
  "transactionHash": "0x1234567890abcdef...",
  "blockNumber": 4567890,
  "status": "success",
  "from": "0x...",
  "to": "0x8ba1f109551bd432803012645ac136ddd64dba72",
  "value": "1000000000000000"
}
```

---

## Development Commands

```bash
# Start dev server with auto-reload
npm run dev

# Build TypeScript
npm run build

# Start production server
npm start

# Type checking
npm run type-check
```

---

## Troubleshooting

### Issue: "Missing required environment variable"

**Solution:** Ensure all variables in `.env.example` are filled in `.env`

```bash
cat .env  # Check all variables are set
```

### Issue: "Cannot find module '@supabase/supabase-js'"

**Solution:** Reinstall dependencies

```bash
rm -rf node_modules
npm install
```

### Issue: "Invalid Supabase credentials"

**Solution:** Verify credentials in Supabase dashboard:
1. Go to Settings → API
2. Double-check URL and keys
3. Ensure project is initialized

### Issue: "Para wallet creation failed"

**Solution:** 
1. Check Para API key is valid
2. Ensure API key has wallet creation permissions
3. Try creating wallet manually in Para dashboard

### Issue: "Invalid RPC URL"

**Solution:**
1. Verify Sepolia RPC URL format
2. Check Infura/Alchemy API key is correct
3. Ensure you're using Sepolia network, not mainnet

### Issue: "Wallet balance is 0 after funding"

**Solution:**
1. Wait a few blocks (~15-30 seconds)
2. Check transaction on https://sepolia.etherscan.io
3. Use a different faucet if first one didn't work

---

## IDE Setup

### VS Code

Install extensions:
- TypeScript Vue Plugin
- Prettier Code Formatter
- Thunder Client (for API testing)

### Debugging

Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Launch Program",
      "program": "${workspaceFolder}/node_modules/.bin/ts-node",
      "args": ["${workspaceFolder}/src/index.ts"],
      "outFiles": ["${workspaceFolder}/dist/**/*.js"]
    }
  ]
}
```

---

## Next Steps

1. Read [README.md](./README.md) for architecture overview
2. Read [API.md](./API.md) for detailed endpoint documentation
3. Explore the codebase in `src/`
4. Check Para docs: https://docs.getpara.com
5. Check Supabase docs: https://supabase.com/docs

---

## Need Help?

- Open a GitHub issue
- Check Para Discord: https://discord.gg/getpara
- Check Supabase Discord: https://discord.supabase.com

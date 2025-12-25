# Quick Start Guide

Get the backend running in **5 minutes**.

---

## 1. Prerequisites (Already Have? Skip This)

```bash
# Check Node.js is installed
node --version  # Must be v16+
npm --version
```

If not installed:
- Download: https://nodejs.org (LTS version)

---

## 2. Clone & Install

```bash
git clone https://github.com/prajalsharma/para-fintech-backend
cd para-fintech-backend
npm install  # Takes ~30 seconds
```

---

## 3. Setup Credentials (10 minutes)

### Supabase
1. Go to https://supabase.com → New Project
2. Wait for project to initialize
3. Click **Settings** → **API**
4. Copy:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
5. Click **JWT Settings**
6. Copy JWT Secret → `SUPABASE_JWT_SECRET`

### Para API
1. Go to https://getpara.com → Sign Up
2. Create account
3. Dashboard → **API Keys**
4. Generate key → `PARA_API_KEY`

### Infura (RPC)
1. Go to https://infura.io → Sign Up
2. Create new project
3. Select **Sepolia** network
4. Copy HTTP endpoint → `SEPOLIA_RPC_URL`

---

## 4. Create .env File

```bash
cp .env.example .env
```

Edit `.env` and paste your credentials:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SUPABASE_JWT_SECRET=your-secret

# Para
PARA_API_KEY=para_...

# Ethereum
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR-ID

# Server
PORT=3000
NODE_ENV=development
```

**Save the file. Don't commit it!**

---

## 5. Create Database Table

1. In Supabase dashboard: **SQL Editor**
2. **New Query** and paste:

```sql
CREATE TABLE IF NOT EXISTS user_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_id UUID NOT NULL UNIQUE REFERENCES auth.users(id),
  para_wallet_id TEXT NOT NULL UNIQUE,
  wallet_address TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX user_wallets_supabase_id ON user_wallets(supabase_id);
```

3. Click **Run**

---

## 6. Start Server

```bash
npm run dev
```

You should see:
```
✓ Server running on http://localhost:3000
✓ Environment: development

Available endpoints:
  POST   /api/auth/signup
  POST   /api/auth/login
  GET    /api/wallet
  GET    /api/wallet/status
  POST   /api/transaction/send
  GET    /api/transaction/:hash
```

---

## 7. Test It (In New Terminal)

### Signup & Create Wallet

```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123!"
  }'
```

**Save the `access_token` from response** (you'll need it)

### Check Wallet Status

```bash
# Replace TOKEN with your access_token from signup
TOKEN="your-token-here"

curl -X GET http://localhost:3000/api/wallet/status \
  -H "Authorization: Bearer $TOKEN"
```

Wait for:
```json
{
  "status": "ready",
  "address": "0x1234..."
}
```

(If status is still "creating", wait a few seconds and try again)

### Get Wallet Details

```bash
curl -X GET http://localhost:3000/api/wallet \
  -H "Authorization: Bearer $TOKEN"
```

Should show:
```json
{
  "id": "wal_...",
  "status": "ready",
  "address": "0x1234567890abcdef...",
  "balance": {
    "eth": "0",
    "wei": "0"
  }
}
```

### Fund Wallet

Your wallet has 0 ETH. Get testnet funds:

1. Copy your wallet address from above
2. Go to https://sepoliafaucet.com
3. Paste address → Send ETH
4. Wait 30 seconds
5. Check balance again (should show 0.05 ETH)

### Send Transaction

```bash
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
  "transactionHash": "0xabc123...",
  "status": "pending",
  "from": "0x...",
  "to": "0x8ba1f109551bd432803012645ac136ddd64dba72",
  "value": "0.001"
}
```

### Check Transaction Status

```bash
# Replace HASH with transactionHash from above
HASH="0xabc123..."

curl -X GET http://localhost:3000/api/transaction/$HASH
```

After ~15 seconds:
```json
{
  "transactionHash": "0xabc123...",
  "blockNumber": 4567890,
  "status": "success",
  "from": "0x...",
  "to": "0x8ba1f109551bd432803012645ac136ddd64dba72",
  "value": "1000000000000000"
}
```

---

## 8. View on Blockchain

Run this to see your transaction live:

```bash
# Replace with your wallet address
WALLET_ADDRESS="0x1234567890abcdef..."

echo "View wallet: https://sepolia.etherscan.io/address/$WALLET_ADDRESS"
```

---

## Troubleshooting

### "Cannot find module"
```bash
rm -rf node_modules
npm install
```

### "Invalid Supabase URL"
- Check credentials in Supabase dashboard
- Ensure project is initialized (not loading)

### "Wallet not ready"
- Wait 20-30 seconds for MPC key generation
- Keep polling `/wallet/status`

### "Transaction failed"
- Check wallet has enough ETH (get more from faucet)
- Verify recipient address is valid
- Check recipient address is not your own wallet

### "Transaction stuck"
- Sepolia may be congested
- Check on https://sepolia.etherscan.io
- Try again in a few minutes

---

## Next Steps

1. **Read documentation**
   - [README.md](./README.md) - Full overview
   - [API.md](./API.md) - Complete API reference
   - [DEVX_FEEDBACK.md](./DEVX_FEEDBACK.md) - How Para works

2. **Run full E2E test**
   ```bash
   bash test-flow.sh
   ```

3. **Try more operations**
   - Create multiple users
   - Send transactions to different addresses
   - Check different wallet statuses

4. **Deploy to production** (when ready)
   - See [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) - Deployment section

---

## Success Checklist

- [ ] Server running on http://localhost:3000
- [ ] Can signup and get JWT token
- [ ] Wallet address appears in `/wallet/status`
- [ ] Wallet receives testnet ETH
- [ ] Can send transaction
- [ ] Transaction appears on Sepolia etherscan

**If all checked:** ✅ You're ready to build!

---

## Need Help?

- Check detailed setup: [SETUP.md](./SETUP.md)
- API reference: [API.md](./API.md)
- GitHub issues: https://github.com/prajalsharma/para-fintech-backend/issues

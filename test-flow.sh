#!/bin/bash

# Para Fintech Backend - End-to-End Test Flow
# This script tests the complete user journey: signup -> wallet -> transaction

set -e  # Exit on error

# Configuration
BASE_URL="http://localhost:3000/api"
TEST_EMAIL="test-$(date +%s)@example.com"
TEST_PASSWORD="TestPassword123!"
RECIPIENT_ADDRESS="0x8ba1f109551bd432803012645ac136ddd64dba72"

echo "\n=== Para Fintech Backend - E2E Test ==="
echo "Base URL: $BASE_URL"
echo "Test Email: $TEST_EMAIL"

# Color output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
success() {
    echo -e "${GREEN}✓ $1${NC}"
}

error() {
    echo -e "${RED}✗ $1${NC}"
    exit 1
}

info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Test 1: Signup
echo "\n--- Test 1: Signup & Wallet Creation ---"
info "Creating user and provisioning wallet..."

SIGNUP_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }")

echo "Response: $SIGNUP_RESPONSE" | jq .

USER_ID=$(echo "$SIGNUP_RESPONSE" | jq -r '.user.id')
ACCESS_TOKEN=$(echo "$SIGNUP_RESPONSE" | jq -r '.session.access_token')
WALLET_ID=$(echo "$SIGNUP_RESPONSE" | jq -r '.wallet.id')
WALLET_STATUS=$(echo "$SIGNUP_RESPONSE" | jq -r '.wallet.status')

if [[ -z "$ACCESS_TOKEN" ]] || [[ "$ACCESS_TOKEN" == "null" ]]; then
    error "Failed to get access token"
fi

if [[ -z "$WALLET_ID" ]] || [[ "$WALLET_ID" == "null" ]]; then
    error "Failed to get wallet ID"
fi

success "User created: $USER_ID"
success "Access token obtained: ${ACCESS_TOKEN:0:20}..."
success "Wallet ID: $WALLET_ID"
info "Wallet status: $WALLET_STATUS"

# Test 2: Poll wallet until ready
echo "\n--- Test 2: Poll Wallet Status ---"
info "Waiting for wallet to be ready (status: creating -> ready)..."

MAX_ATTEMPTS=30
ATTEMPT=0
WALLET_ADDRESS=""

while [[ $ATTEMPT -lt $MAX_ATTEMPTS ]]; do
    WALLET_STATUS_RESPONSE=$(curl -s -X GET "$BASE_URL/wallet/status" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    
    CURRENT_STATUS=$(echo "$WALLET_STATUS_RESPONSE" | jq -r '.status')
    WALLET_ADDRESS=$(echo "$WALLET_STATUS_RESPONSE" | jq -r '.address')
    
    if [[ "$CURRENT_STATUS" == "ready" ]]; then
        success "Wallet is ready!"
        success "Wallet Address: $WALLET_ADDRESS"
        break
    fi
    
    ATTEMPT=$((ATTEMPT + 1))
    if [[ $((ATTEMPT % 5)) -eq 0 ]]; then
        info "Still creating... (attempt $ATTEMPT/$MAX_ATTEMPTS)"
    fi
    sleep 1
done

if [[ "$CURRENT_STATUS" != "ready" ]]; then
    error "Wallet did not become ready after $MAX_ATTEMPTS attempts"
fi

# Test 3: Get full wallet details
echo "\n--- Test 3: Get Full Wallet Details ---"
info "Fetching complete wallet information including balance..."

WALLET_RESPONSE=$(curl -s -X GET "$BASE_URL/wallet" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Response: $WALLET_RESPONSE" | jq .

BALANCE_ETH=$(echo "$WALLET_RESPONSE" | jq -r '.balance.eth')
PUBLIC_KEY=$(echo "$WALLET_RESPONSE" | jq -r '.publicKey')

success "Wallet Type: EVM"
success "Public Key: ${PUBLIC_KEY:0:30}..."
info "Current Balance: $BALANCE_ETH ETH"

# Test 4: Check if we have funds
echo "\n--- Test 4: Check Wallet Balance ---"
if [[ "$BALANCE_ETH" == "0" ]] || [[ "$BALANCE_ETH" == "0.0" ]]; then
    error "Wallet has no funds. Get testnet ETH from: https://sepoliafaucet.com"
fi

success "Wallet funded with $BALANCE_ETH ETH"

# Test 5: Send transaction
echo "\n--- Test 5: Send Transaction ---"
info "Sending 0.001 ETH transaction..."

TX_RESPONSE=$(curl -s -X POST "$BASE_URL/transaction/send" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"to\": \"$RECIPIENT_ADDRESS\",
    \"amount\": \"0.001\"
  }")

echo "Response: $TX_RESPONSE" | jq .

TX_HASH=$(echo "$TX_RESPONSE" | jq -r '.transactionHash')
TX_STATUS=$(echo "$TX_RESPONSE" | jq -r '.status')

if [[ -z "$TX_HASH" ]] || [[ "$TX_HASH" == "null" ]]; then
    error "Failed to get transaction hash"
fi

success "Transaction sent: $TX_HASH"
info "Status: $TX_STATUS"

# Test 6: Poll transaction status
echo "\n--- Test 6: Poll Transaction Status ---"
info "Waiting for transaction confirmation (max 2 minutes)..."

MAX_TX_ATTEMPTS=120
TX_ATTEMPT=0
TX_CONFIRMED=0

while [[ $TX_ATTEMPT -lt $MAX_TX_ATTEMPTS ]]; do
    TX_STATUS_RESPONSE=$(curl -s -X GET "$BASE_URL/transaction/$TX_HASH")
    
    if echo "$TX_STATUS_RESPONSE" | jq empty 2>/dev/null; then
        CONFIRMED_STATUS=$(echo "$TX_STATUS_RESPONSE" | jq -r '.status')
        BLOCK_NUMBER=$(echo "$TX_STATUS_RESPONSE" | jq -r '.blockNumber')
        
        if [[ -n "$BLOCK_NUMBER" ]] && [[ "$BLOCK_NUMBER" != "null" ]]; then
            echo "Response: $TX_STATUS_RESPONSE" | jq .
            success "Transaction confirmed in block $BLOCK_NUMBER"
            success "Transaction Status: $CONFIRMED_STATUS"
            TX_CONFIRMED=1
            break
        fi
    fi
    
    TX_ATTEMPT=$((TX_ATTEMPT + 1))
    if [[ $((TX_ATTEMPT % 10)) -eq 0 ]]; then
        info "Waiting for confirmation... (attempt $TX_ATTEMPT/$MAX_TX_ATTEMPTS)"
    fi
    sleep 1
done

if [[ $TX_CONFIRMED -eq 0 ]]; then
    info "Transaction not yet confirmed (expected on Sepolia testnet)"
    info "Check status later with: curl $BASE_URL/transaction/$TX_HASH"
fi

# Test 7: Login (verify JWT works)
echo "\n--- Test 7: Test Login ---"
info "Attempting to login with test credentials..."

LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }")

echo "Response: $LOGIN_RESPONSE" | jq .

LOGIN_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.session.access_token')

if [[ -z "$LOGIN_TOKEN" ]] || [[ "$LOGIN_TOKEN" == "null" ]]; then
    error "Failed to login"
fi

success "Login successful"
info "New token: ${LOGIN_TOKEN:0:20}..."

# Summary
echo "\n=== Test Summary ==="
success "All tests completed!"
echo ""
echo "Results:"
echo "  Email: $TEST_EMAIL"
echo "  User ID: $USER_ID"
echo "  Wallet Address: $WALLET_ADDRESS"
echo "  Wallet ID: $WALLET_ID"
echo "  Transaction Hash: $TX_HASH"
echo "  Recipient: $RECIPIENT_ADDRESS"
echo ""
echo "Links:"
echo "  View wallet on Sepolia: https://sepolia.etherscan.io/address/$WALLET_ADDRESS"
echo "  View transaction: https://sepolia.etherscan.io/tx/$TX_HASH"
echo ""
echo "Next steps:"
echo "  - Check wallet balance on Sepolia Etherscan"
echo "  - Try sending more transactions"
echo "  - Experiment with different amounts and recipients"

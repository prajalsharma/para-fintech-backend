// User and Wallet Mapping
export interface UserWallet {
  supabase_id: string;
  para_wallet_id: string;
  wallet_address?: string;
  created_at: string;
  updated_at: string;
}

// Para API Response Types
export interface ParaWallet {
  id: string;
  type: "EVM";
  status: "creating" | "ready";
  address?: string;
  publicKey?: string;
  createdAt: string;
  scheme: "DKLS";
  userIdentifier: string;
  userIdentifierType: "EMAIL" | "PHONE" | "CUSTOM_ID";
}

export interface ParaSignResponse {
  signature: string;
  data: string;
}

// Transaction Request/Response
export interface SendTransactionRequest {
  to: string;
  amount: string; // in ETH
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

export interface SendTransactionResponse {
  transactionHash: string;
  status: "pending" | "success";
  from: string;
  to: string;
  value: string;
}

// Wallet Balance
export interface WalletBalance {
  address: string;
  balance: string; // in Wei
  balanceEth: string; // in ETH
}

// Auth Types
export interface SignupRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
  };
  session: {
    access_token: string;
    token_type: string;
  };
}

// Error Response
export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

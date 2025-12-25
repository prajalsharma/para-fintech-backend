import dotenv from "dotenv";

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || "3000"),
  nodeEnv: process.env.NODE_ENV || "development",

  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL!,
    anonKey: process.env.SUPABASE_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    jwtSecret: process.env.SUPABASE_JWT_SECRET!,
  },

  // Para API
  para: {
    apiKey: process.env.PARA_API_KEY!,
    baseUrl: process.env.PARA_BASE_URL || "https://api.getpara.com",
  },

  // Ethereum
  ethereum: {
    rpcUrl: process.env.SEPOLIA_RPC_URL!,
    chainId: parseInt(process.env.SEPOLIA_CHAIN_ID || "11155111"),
  },
};

// Validation
const requiredVars = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET",
  "PARA_API_KEY",
  "SEPOLIA_RPC_URL",
];

for (const variable of requiredVars) {
  if (!process.env[variable]) {
    throw new Error(`Missing required environment variable: ${variable}`);
  }
}

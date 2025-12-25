import { createClient } from "@supabase/supabase-js";
import { config } from "../config";
import { UserWallet } from "../types";

// Using service role key for admin-level database operations
const supabaseAdmin = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey
);

export const databaseService = {
  /**
   * Store the mapping from Supabase user ID to Para wallet ID
   * This is the minimal state needed: only non-sensitive mappings
   */
  async saveUserWallet(
    supabaseId: string,
    paraWalletId: string,
    walletAddress?: string
  ): Promise<UserWallet> {
    const { data, error } = await supabaseAdmin
      .from("user_wallets")
      .insert({
        supabase_id: supabaseId,
        para_wallet_id: paraWalletId,
        wallet_address: walletAddress,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save user wallet: ${error.message}`);
    }

    return data;
  },

  /**
   * Retrieve wallet ID for a Supabase user
   */
  async getUserWallet(supabaseId: string): Promise<UserWallet | null> {
    const { data, error } = await supabaseAdmin
      .from("user_wallets")
      .select("*")
      .eq("supabase_id", supabaseId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // Row not found
        return null;
      }
      throw new Error(`Failed to fetch user wallet: ${error.message}`);
    }

    return data;
  },

  /**
   * Update wallet address after it becomes ready
   */
  async updateWalletAddress(
    supabaseId: string,
    walletAddress: string
  ): Promise<UserWallet> {
    const { data, error } = await supabaseAdmin
      .from("user_wallets")
      .update({
        wallet_address: walletAddress,
        updated_at: new Date().toISOString(),
      })
      .eq("supabase_id", supabaseId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update wallet address: ${error.message}`);
    }

    return data;
  },

  /**
   * Initialize database tables if they don't exist
   * Run this once on app startup
   */
  async initializeSchema(): Promise<void> {
    // Create user_wallets table if it doesn't exist
    const { error } = await supabaseAdmin.rpc("exec", {
      sql: `
        CREATE TABLE IF NOT EXISTS user_wallets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          supabase_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
          para_wallet_id TEXT NOT NULL UNIQUE,
          wallet_address TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS user_wallets_supabase_id ON user_wallets(supabase_id);
        CREATE INDEX IF NOT EXISTS user_wallets_para_wallet_id ON user_wallets(para_wallet_id);
      `,
    });

    // If rpc doesn't exist, log a note about manual setup
    if (error) {
      console.warn(
        "Could not auto-initialize database schema. Please ensure the following table exists in Supabase:\n",
        `
        CREATE TABLE IF NOT EXISTS user_wallets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          supabase_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
          para_wallet_id TEXT NOT NULL UNIQUE,
          wallet_address TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
      );
    }
  },
};

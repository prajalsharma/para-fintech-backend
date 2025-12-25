import axios from "axios";
import { config } from "../config";
import { ParaWallet, ParaSignResponse } from "../types";

const paraClient = axios.create({
  baseURL: config.para.baseUrl,
  headers: {
    "X-API-Key": config.para.apiKey,
    "Content-Type": "application/json",
  },
});

export const paraService = {
  /**
   * Create a new wallet for a user
   * Uses CUSTOM_ID type with Supabase user ID to avoid collisions
   */
  async createWallet(supabaseUserId: string): Promise<ParaWallet> {
    try {
      const response = await paraClient.post<ParaWallet>("/v1/wallets", {
        type: "EVM",
        userIdentifier: supabaseUserId,
        userIdentifierType: "CUSTOM_ID",
      });

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 409) {
        throw new Error(
          `Wallet already exists for user ${supabaseUserId}. One wallet per (type, scheme, userIdentifier) is allowed.`
        );
      }
      throw new Error(`Para wallet creation failed: ${error.message}`);
    }
  },

  /**
   * Retrieve wallet details by ID
   * Call this after creation to check status and get address once ready
   */
  async getWallet(walletId: string): Promise<ParaWallet> {
    try {
      const response = await paraClient.get<ParaWallet>(`/v1/wallets/${walletId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(
        `Failed to fetch wallet ${walletId}: ${error.response?.data?.message || error.message}`
      );
    }
  },

  /**
   * Poll wallet until it's ready
   * Useful after creation; waits for MPC key-gen to complete
   */
  async pollWalletReady(
    walletId: string,
    maxAttempts: number = 30,
    delayMs: number = 1000
  ): Promise<ParaWallet> {
    let attempts = 0;
    let wallet: ParaWallet;

    while (attempts < maxAttempts) {
      wallet = await this.getWallet(walletId);

      if (wallet.status === "ready") {
        return wallet;
      }

      attempts++;
      if (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw new Error(
      `Wallet ${walletId} did not become ready after ${maxAttempts} attempts`
    );
  },

  /**
   * Sign a raw transaction hash
   * Para holds one key share in secure enclave, user holds the other via WebAuthn
   * Returns signature only; private key never assembled in single place (non-custodial)
   */
  async signRaw(walletId: string, dataHash: string): Promise<ParaSignResponse> {
    try {
      // Ensure data is hex-prefixed
      const hexData = dataHash.startsWith("0x") ? dataHash : `0x${dataHash}`;

      const response = await paraClient.post<ParaSignResponse>(
        `/v1/wallets/${walletId}/sign-raw`,
        {
          data: hexData,
        }
      );

      return response.data;
    } catch (error: any) {
      throw new Error(
        `Failed to sign transaction: ${error.response?.data?.message || error.message}`
      );
    }
  },
};

import {
  JsonRpcProvider,
  Transaction,
  parseEther,
  serializeTransaction,
  getAddress,
  toBeHex,
} from "ethers";
import { config } from "../config";
import { SendTransactionRequest, SendTransactionResponse } from "../types";

const provider = new JsonRpcProvider(config.ethereum.rpcUrl);

export const blockchainService = {
  /**
   * Get ETH balance of a wallet address
   */
  async getBalance(address: string): Promise<string> {
    try {
      const checksumAddress = getAddress(address);
      const balanceWei = await provider.getBalance(checksumAddress);
      return balanceWei.toString(); // Return in wei
    } catch (error: any) {
      throw new Error(`Failed to fetch balance: ${error.message}`);
    }
  },

  /**
   * Get balance in ETH format
   */
  async getBalanceInEth(address: string): Promise<string> {
    const balanceWei = await this.getBalance(address);
    return (BigInt(balanceWei) / BigInt(10) ** BigInt(18)).toString();
  },

  /**
   * Get current nonce (transaction count) for an address
   */
  async getNonce(address: string): Promise<number> {
    try {
      const checksumAddress = getAddress(address);
      return await provider.getTransactionCount(checksumAddress);
    } catch (error: any) {
      throw new Error(`Failed to fetch nonce: ${error.message}`);
    }
  },

  /**
   * Get current gas prices from Sepolia
   */
  async getGasPrices(): Promise<{
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
  }> {
    try {
      const feeData = await provider.getFeeData();

      if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
        throw new Error("Could not fetch fee data from provider");
      }

      return {
        maxFeePerGas: feeData.maxFeePerGas.toString(),
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.toString(),
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch gas prices: ${error.message}`);
    }
  },

  /**
   * Build an unsigned EIP-1559 transaction
   * Returns the transaction object and serialized data hash for signing
   */
  async buildUnsignedTransaction(
    fromAddress: string,
    request: SendTransactionRequest
  ): Promise<{
    transaction: any;
    dataHash: string;
  }> {
    try {
      const checksumFrom = getAddress(fromAddress);
      const checksumTo = getAddress(request.to);

      const nonce = await this.getNonce(checksumFrom);
      const gasPrices = await this.getGasPrices();

      // Use provided gas values or defaults
      const gasLimit = request.gasLimit ? BigInt(request.gasLimit) : BigInt(21000);
      const maxFeePerGas = request.maxFeePerGas
        ? BigInt(request.maxFeePerGas)
        : BigInt(gasPrices.maxFeePerGas);
      const maxPriorityFeePerGas = request.maxPriorityFeePerGas
        ? BigInt(request.maxPriorityFeePerGas)
        : BigInt(gasPrices.maxPriorityFeePerGas);

      // Build EIP-1559 transaction (type 2)
      const transaction = {
        type: 2,
        to: checksumTo,
        from: checksumFrom,
        value: parseEther(request.amount),
        data: "0x",
        gasLimit,
        nonce,
        maxFeePerGas,
        maxPriorityFeePerGas,
        chainId: config.ethereum.chainId,
      };

      // Serialize without signature to get the hash for signing
      const serialized = serializeTransaction(transaction);

      return {
        transaction,
        dataHash: serialized,
      };
    } catch (error: any) {
      throw new Error(`Failed to build transaction: ${error.message}`);
    }
  },

  /**
   * Broadcast a signed transaction to Sepolia
   */
  async broadcastTransaction(signedTransaction: string): Promise<string> {
    try {
      const txResponse = await provider.broadcastTransaction(signedTransaction);
      return txResponse.hash;
    } catch (error: any) {
      throw new Error(
        `Failed to broadcast transaction: ${error.response?.data?.message || error.message}`
      );
    }
  },

  /**
   * Serialize transaction with signature
   * Used after Para returns a signature
   */
  serializeWithSignature(
    transaction: any,
    signature: string
  ): string {
    // Ensure signature is properly formatted
    const cleanSig = signature.startsWith("0x") ? signature : `0x${signature}`;

    // Add signature fields to transaction
    const signedTx = {
      ...transaction,
      signature: cleanSig,
    };

    return serializeTransaction(signedTx);
  },

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(
    txHash: string,
    confirmations: number = 1
  ): Promise<any> {
    try {
      const receipt = await provider.waitForTransaction(txHash, confirmations);
      return receipt;
    } catch (error: any) {
      throw new Error(
        `Failed to wait for transaction: ${error.message}`
      );
    }
  },
};

import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth";
import { databaseService } from "../services/database";
import { paraService } from "../services/para";
import { blockchainService } from "../services/blockchain";
import { SendTransactionRequest } from "../types";
import { getAddress, keccak256, toUtf8Bytes } from "ethers";

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * POST /transaction/send
 * Send cryptocurrency from user's wallet
 * 
 * Flow:
 * 1. Get wallet address from database
 * 2. Build unsigned transaction (get nonce, fees)
 * 3. Hash transaction data
 * 4. Call Para to sign the hash
 * 5. Serialize signed transaction
 * 6. Broadcast to Sepolia
 * 
 * Request: { to: string, amount: string, gasLimit?: string, maxFeePerGas?: string, maxPriorityFeePerGas?: string }
 * Response: { transactionHash: string, status: string, from: string, to: string, value: string }
 */
router.post("/send", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User ID not found in token",
      });
    }

    const sendRequest = req.body as SendTransactionRequest;

    // Validate request
    if (!sendRequest.to || !sendRequest.amount) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Missing required fields: 'to' and 'amount'",
      });
    }

    // Validate addresses
    try {
      getAddress(sendRequest.to);
    } catch {
      return res.status(400).json({
        error: "Bad Request",
        message: "Invalid Ethereum address for 'to' field",
      });
    }

    // Step 1: Get user's wallet from database
    const userWallet = await databaseService.getUserWallet(userId);
    if (!userWallet) {
      return res.status(404).json({
        error: "Not Found",
        message: "Wallet not found for this user",
      });
    }

    // Step 2: Get wallet details from Para to ensure it's ready
    const paraWallet = await paraService.getWallet(userWallet.para_wallet_id);
    if (paraWallet.status !== "ready" || !paraWallet.address) {
      return res.status(400).json({
        error: "Wallet Not Ready",
        message: "Wallet is still being created. Please try again later.",
      });
    }

    // Step 3: Build unsigned transaction
    const { transaction, dataHash } = await blockchainService.buildUnsignedTransaction(
      paraWallet.address,
      sendRequest
    );

    // Step 4: Sign with Para
    const signResponse = await paraService.signRaw(
      userWallet.para_wallet_id,
      dataHash
    );

    // Step 5: Serialize signed transaction
    const signedTx = blockchainService.serializeWithSignature(
      transaction,
      signResponse.signature
    );

    // Step 6: Broadcast to Sepolia
    const txHash = await blockchainService.broadcastTransaction(signedTx);

    return res.status(201).json({
      transactionHash: txHash,
      status: "pending",
      from: paraWallet.address,
      to: sendRequest.to,
      value: sendRequest.amount,
      message: "Transaction broadcasted. Monitor the hash on Sepolia block explorer.",
    });
  } catch (error: any) {
    console.error("Transaction send error:", error);
    return res.status(500).json({
      error: "Transaction Failed",
      message: error.message,
    });
  }
});

/**
 * GET /transaction/:txHash
 * Check transaction status on Sepolia
 *
 * Response: { status, blockNumber, from, to, value, gas }
 */
router.get("/:txHash", async (req: Request, res: Response) => {
  try {
    const { txHash } = req.params;

    // Validate hash format
    if (!txHash.startsWith("0x") || txHash.length !== 66) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Invalid transaction hash format",
      });
    }

    // Query blockchain for transaction
    try {
      const receipt = await blockchainService.waitForTransaction(txHash, 0);

      if (!receipt) {
        return res.status(404).json({
          error: "Not Found",
          message: "Transaction not found or not yet mined",
        });
      }

      return res.status(200).json({
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        status: receipt.status === 1 ? "success" : "failed",
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: receipt.gasPrice?.toString(),
        from: receipt.from,
        to: receipt.to,
        value: receipt.value?.toString() || "0",
      });
    } catch {
      return res.status(404).json({
        error: "Not Found",
        message: "Transaction not yet mined or invalid hash",
      });
    }
  } catch (error: any) {
    console.error("Transaction status error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
    });
  }
});

export default router;

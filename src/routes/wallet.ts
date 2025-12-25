import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth";
import { databaseService } from "../services/database";
import { paraService } from "../services/para";
import { blockchainService } from "../services/blockchain";

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * GET /wallet
 * Retrieve wallet details for authenticated user
 * Includes address, status, and current ETH balance
 *
 * Response: { id, type, status, address, balanceWei, balanceEth, createdAt }
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User ID not found in token",
      });
    }

    // Step 1: Get wallet ID from database
    const userWallet = await databaseService.getUserWallet(userId);
    if (!userWallet) {
      return res.status(404).json({
        error: "Not Found",
        message: "Wallet not found for this user",
      });
    }

    // Step 2: Fetch wallet details from Para
    const paraWallet = await paraService.getWallet(userWallet.para_wallet_id);

    let balance = null;
    // Step 3: Fetch balance if wallet is ready
    if (paraWallet.status === "ready" && paraWallet.address) {
      const balanceWei = await blockchainService.getBalance(paraWallet.address);
      const balanceEth = await blockchainService.getBalanceInEth(
        paraWallet.address
      );
      balance = { wei: balanceWei, eth: balanceEth };
    }

    return res.status(200).json({
      id: paraWallet.id,
      type: paraWallet.type,
      status: paraWallet.status,
      address: paraWallet.address || null,
      publicKey: paraWallet.publicKey || null,
      balance,
      createdAt: paraWallet.createdAt,
      message:
        paraWallet.status === "creating"
          ? "Wallet is still being created. MPC key generation in progress."
          : "Wallet is ready for transactions!",
    });
  } catch (error: any) {
    console.error("Wallet fetch error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
    });
  }
});

/**
 * GET /wallet/status
 * Quick status check without fetching balance (lighter request)
 *
 * Response: { status, address }
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User ID not found in token",
      });
    }

    const userWallet = await databaseService.getUserWallet(userId);
    if (!userWallet) {
      return res.status(404).json({
        error: "Not Found",
        message: "Wallet not found for this user",
      });
    }

    const paraWallet = await paraService.getWallet(userWallet.para_wallet_id);

    return res.status(200).json({
      status: paraWallet.status,
      address: paraWallet.address || null,
    });
  } catch (error: any) {
    console.error("Status check error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
    });
  }
});

export default router;

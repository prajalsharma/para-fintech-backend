import { Router, Request, Response } from "express";
import { supabaseService } from "../services/supabase";
import { paraService } from "../services/para";
import { databaseService } from "../services/database";
import { SignupRequest, LoginRequest } from "../types";

const router = Router();

/**
 * POST /auth/signup
 * Create a new user with Supabase and automatically provision a Para wallet
 *
 * Request: { email: string, password: string }
 * Response: { user: {...}, session: {...}, wallet: { id, status, address? } }
 */
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as SignupRequest;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Email and password are required",
      });
    }

    // Step 1: Create user in Supabase
    const authResponse = await supabaseService.signup({ email, password });
    const supabaseUserId = authResponse.user.id;

    // Step 2: Create wallet in Para
    let paraWallet;
    try {
      paraWallet = await paraService.createWallet(supabaseUserId);
    } catch (paraError: any) {
      // If wallet creation fails, clean up the Supabase user
      console.error("Para wallet creation failed:", paraError.message);
      return res.status(500).json({
        error: "Wallet Creation Failed",
        message: paraError.message,
      });
    }

    // Step 3: Store mapping in database
    try {
      await databaseService.saveUserWallet(supabaseUserId, paraWallet.id);
    } catch (dbError: any) {
      console.error("Database save failed:", dbError.message);
      return res.status(500).json({
        error: "Database Error",
        message: dbError.message,
      });
    }

    return res.status(201).json({
      user: authResponse.user,
      session: authResponse.session,
      wallet: {
        id: paraWallet.id,
        status: paraWallet.status,
        address: paraWallet.address || null,
        message:
          paraWallet.status === "creating"
            ? "Wallet is being created. Poll the /wallet endpoint to check status."
            : "Wallet is ready!",
      },
    });
  } catch (error: any) {
    console.error("Signup error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
    });
  }
});

/**
 * POST /auth/login
 * Authenticate existing user with Supabase
 *
 * Request: { email: string, password: string }
 * Response: { user: {...}, session: {...} }
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as LoginRequest;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Email and password are required",
      });
    }

    // Authenticate with Supabase
    const authResponse = await supabaseService.login({ email, password });

    return res.status(200).json(authResponse);
  } catch (error: any) {
    console.error("Login error:", error);
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid email or password",
    });
  }
});

export default router;

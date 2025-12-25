import { Request, Response, NextFunction } from "express";
import { supabaseService } from "../services/supabase";

// Extend Express Request to include user context
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
      };
    }
  }
}

/**
 * Middleware to verify Supabase JWT token
 * Extracts user ID from token and attaches to request
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Missing Authorization header",
      });
    }

    // Extract Bearer token
    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid Authorization header format. Use 'Bearer <token>'",
      });
    }

    // Verify token with Supabase
    const user = await supabaseService.verifyToken(token);
    req.user = user;

    next();
  } catch (error: any) {
    return res.status(401).json({
      error: "Unauthorized",
      message: error.message,
    });
  }
};

/**
 * Optional middleware for rate limiting (can be expanded)
 */
export const rateLimitMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // TODO: Implement rate limiting per user
  next();
};

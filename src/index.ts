import express, { Express, Request, Response } from "express";
import { config } from "./config";
import { databaseService } from "./services/database";
import authRoutes from "./routes/auth";
import walletRoutes from "./routes/wallet";
import transactionRoutes from "./routes/transaction";

const app: Express = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req: Request, res: Response, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/transaction", transactionRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handling middleware
app.use((error: any, req: Request, res: Response, next: Function) => {
  console.error("Unhandled error:", error);
  res.status(error.status || 500).json({
    error: error.name || "Internal Server Error",
    message: error.message,
  });
});

// Initialize and start server
const startServer = async () => {
  try {
    // Initialize database schema
    console.log("Initializing database schema...");
    await databaseService.initializeSchema();
    console.log("Database schema initialized.");

    // Start listening
    app.listen(config.port, () => {
      console.log(`✓ Server running on http://localhost:${config.port}`);
      console.log(`✓ Environment: ${config.nodeEnv}`);
      console.log(`\nAvailable endpoints:`);
      console.log(`  POST   /api/auth/signup         - Register new user & create wallet`);
      console.log(`  POST   /api/auth/login          - Login existing user`);
      console.log(`  GET    /api/wallet              - View wallet details & balance`);
      console.log(`  GET    /api/wallet/status       - Quick wallet status check`);
      console.log(`  POST   /api/transaction/send    - Send crypto transaction`);
      console.log(`  GET    /api/transaction/:hash   - Check transaction status`);
      console.log(`  GET    /health                  - Health check`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

export default app;

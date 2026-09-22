const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const authRoutes = require("./routes/auth.routes");

const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Security
app.use(helmet());
app.use(cors());

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging (skip in test env to keep test output clean)
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// Global rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
});
app.use("/api", limiter);

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Social Blog API is healthy",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

// Root
app.get("/", (req, res) => {
  res.json({ message: "Social Blog API is running" });
});

// API routes
app.use("/api/auth", authRoutes);

// TEMPORARY — used to verify auth middleware
const { protect, optionalAuth } = require("./middleware/auth");
app.get("/api/_test/protected", protect, (req, res) => {
  res.json({
    success: true,
    message: "Access granted",
    user: req.user.toJSON(),
  });
});
app.get("/api/_test/optional", optionalAuth, (req, res) => {
  res.json({
    success: true,
    authenticated: Boolean(req.user),
    user: req.user ? req.user.toJSON() : null,
  });
});

// 404 + Error handlers
app.use(notFound);
app.use(errorHandler);

module.exports = app;

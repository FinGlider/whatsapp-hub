require("dotenv").config({ quiet: true });
const express = require("express");
const bodyParser = require("body-parser");
const { testConnection } = require("./config/database");

const metaWebhookRoutes = require("./routes/metaWebhook.route");
const adminRoutes = require("./routes/admin.route");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use("/meta", metaWebhookRoutes);
app.use("/admin", adminRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    service: "WhatsApp Hub",
    version: "2.0.0",
    status: "running",
    endpoints: {
      webhook: "/meta/webhook",
      admin: "/admin",
      health: "/admin/health",
    },
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Start server with database connection
async function startServer() {
  try {
    // Test database connection first
    await testConnection();

    // Start the server
    app.listen(PORT, () => {
      console.log(`🚀 Webhook Hub running on port ${PORT}`);
      console.log(`📡 Webhook endpoint: http://localhost:${PORT}/meta/webhook`);
      console.log(`⚙️  Admin API: http://localhost:${PORT}/admin`);
      console.log(`💚 Health check: http://localhost:${PORT}/admin/health`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("⚠️  SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("⚠️  SIGINT received, shutting down gracefully...");
  process.exit(0);
});

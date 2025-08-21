require("dotenv").config({ quiet: true });
const express = require("express");
const bodyParser = require("body-parser");

const metaWebhookRoutes = require("./routes/metaWebhook.route");

const app = express();
const PORT = process.env.PORT || 3000;

// Increase payload limit if needed
app.use(bodyParser.json({ limit: "10mb" }));

// Add basic request validation middleware
app.use((req, res, next) => {
  if (req.method === "POST" && !req.is("application/json")) {
    return res
      .status(415)
      .json({ error: "Content-Type must be application/json" });
  }
  next();
});

app.use("/meta", metaWebhookRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Webhook Hub running on port number ${PORT}`);
});

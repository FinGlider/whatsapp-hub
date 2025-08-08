require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");

const metaWebhookRoutes = require("./routes/metaWebhook.route");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.use("/meta", metaWebhookRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Webhook Hub running on http://localhost:${PORT}`);
});

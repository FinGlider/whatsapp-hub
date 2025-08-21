const express = require("express");
const router = express.Router();
const metaWebhookController = require("../controllers/metaWebhook.controller");

router.get("/webhook", metaWebhookController.verifyWebhook);
router.post("/webhook", metaWebhookController.handleWebhook);

module.exports = router;

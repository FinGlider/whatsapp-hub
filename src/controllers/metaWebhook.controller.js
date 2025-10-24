const {
  getProjectsFromPhoneNumberId,
  getAppByVerifyToken,
} = require("../services/router.service");
const { forwardToProjects } = require("../services/forwarder.service");
const { getCachedProjects } = require("../services/cache.service");
const db = require("../services/db.service");

/**
 * Handle incoming webhook from Meta
 * Forwards to all projects mapped to the phone number
 */
exports.handleWebhook = async (req, res) => {
  try {
    console.log(
      "📩 Received Webhook Event:",
      JSON.stringify(req.body, null, 2)
    );

    const body = req.body;

    // Respond to Meta immediately (within 20 seconds requirement)
    res.sendStatus(200);

    // Extract phone number ID from webhook
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const phoneNumberId = changes?.value?.metadata?.phone_number_id;

    if (!phoneNumberId) {
      console.warn("⚠️  Missing phone_number_id in webhook payload");
      return;
    }

    console.log(`📞 Processing webhook for phone number ID: ${phoneNumberId}`);

    // Get projects with caching
    const projects = await getCachedProjects(
      phoneNumberId,
      db.getProjectsFromPhoneNumberId
    );

    if (!projects || projects.length === 0) {
      console.warn(
        `⚠️  No projects configured for phone number: ${phoneNumberId}`
      );
      return;
    }

    console.log(`🎯 Found ${projects.length} project(s) for this phone number`);

    // Forward webhook to all mapped projects asynchronously
    await forwardToProjects(projects, body);
  } catch (error) {
    console.error("❌ Error in handleWebhook:", error.message);
  }
};

/**
 * Verify webhook during Meta setup
 * Uses database to find app by verify token
 */
exports.verifyWebhook = async (req, res) => {
  try {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    console.log(
      `🔐 Webhook verification request - Mode: ${mode}, Token: ${
        token ? "***" : "missing"
      }`
    );

    if (mode === "subscribe" && token) {
      // Check database for matching app
      const app = await getAppByVerifyToken(token);

      if (app) {
        console.log(
          `✅ Webhook verified for app: ${app.appName} (Business: ${app.businessName})`
        );
        return res.status(200).send(challenge);
      } else {
        console.warn(`❌ Invalid verify token: ${token}`);
        return res.sendStatus(403);
      }
    }

    console.warn("❌ Invalid verification request");
    return res.sendStatus(400);
  } catch (error) {
    console.error("❌ Error in verifyWebhook:", error.message);
    return res.sendStatus(500);
  }
};

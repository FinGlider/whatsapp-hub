const { getProjectFromPhoneNumberId } = require("../services/router.service");
const { forwardToProject } = require("../services/forwarder.service");

exports.handleWebhook = async (req, res) => {
  const body = req.body;

  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const phoneId = changes?.value?.metadata?.phone_number_id;

  if (!phoneId) {
    return res.status(400).send("Missing phone_number_id");
  }

  const project = getProjectFromPhoneNumberId(phoneId);
  if (!project) {
    return res.status(404).send("No matching project for this phone number");
  }

  const result = await forwardToProject(project.endpoint, body);

  if (!result.success) {
    return res.status(500).send("Forwarding failed");
  }

  return res.sendStatus(200);
};

exports.verifyWebhook = (req, res) => {
  const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified");
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
};

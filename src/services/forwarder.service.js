const axios = require("axios");

exports.forwardToProject = async (endpoint, payload) => {
  try {
    await axios.post(endpoint, payload, {
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Source": "meta-hub",
      },
    });
    return { success: true };
  } catch (err) {
    console.error("Forward error:", err.message);
    return { success: false, error: err.message };
  }
};

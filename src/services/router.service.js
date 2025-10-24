const db = require("./db.service");

/**
 * Get all projects mapped to a phone number
 * Returns an array of projects that should receive webhooks for this phone number
 * @param {string} phoneNumberId - The phone number ID from Meta webhook
 * @returns {Promise<Array>} Array of project configurations
 */
exports.getProjectsFromPhoneNumberId = async (phoneNumberId) => {
  return await db.getProjectsFromPhoneNumberId(phoneNumberId);
};

/**
 * Get app by verify token
 * Used during webhook verification
 * @param {string} token - The verify token from Meta
 * @returns {Promise<Object|null>} App configuration or null
 */
exports.getAppByVerifyToken = async (token) => {
  return await db.getAppByVerifyToken(token);
};

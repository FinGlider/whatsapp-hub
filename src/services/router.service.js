const phoneNumberMap = require("../config/projectMap");

exports.getProjectFromPhoneNumberId = (phoneNumberId) => {
  try {
    // Convert to number if string is passed
    const numericId =
      typeof phoneNumberId === "string"
        ? parseInt(phoneNumberId)
        : phoneNumberId;
    return phoneNumberMap[numericId] || null;
  } catch (error) {
    console.error(
      `Error getting project for phone number ID: ${phoneNumberId}`,
      error
    );
    return null;
  }
};

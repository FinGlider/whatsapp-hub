const phoneNumberMap = require("../config/projectMap");

exports.getProjectFromPhoneNumberId = (phoneNumberId) => {
  return phoneNumberMap[phoneNumberId] || null;
};

const { generateToken } = require("../../middleware/jwt");

function getHrToken() {
  return generateToken({ userId: 1, name: "Admin", role: "hr" });
}

function getStandardToken() {
  return generateToken({ userId: 2, name: "Standard User", role: "standard" });
}

module.exports = { getHrToken, getStandardToken };

const { generateToken } = require('./jwt');
const crypto = require('crypto');

const login = (req, res) => {  //belki sonradan giris ozelligi eklenebilir o yuzden simdiden burada dursun
  const { username, password } = req.body;
  
  const validUsername = process.env.AUTH_USERNAME;
  const validPassword = process.env.AUTH_PASSWORD;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  // Timing-safe karşılaştırma
  const userMatch = username.length === validUsername.length &&
    crypto.timingSafeEqual(Buffer.from(username), Buffer.from(validUsername));
  const passMatch = password.length === validPassword.length &&
    crypto.timingSafeEqual(Buffer.from(password), Buffer.from(validPassword));

  if (!userMatch || !passMatch) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = generateToken({ username: validUsername });
  return res.json({ token, success: true });
};

module.exports = { login };
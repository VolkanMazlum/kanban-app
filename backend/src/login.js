const { generateToken } = require('./jwt');
const crypto = require('crypto');

const login = (req, res) => {
  const { username, password } = req.body;
  
  const validUsername = process.env.AUTH_USERNAME;
  const validPassword = process.env.AUTH_PASSWORD; // Assuming hash compare logic will be moved to auth.js, we keep simple check here or use auth.js
  const hrPassword = process.env.HR_PASSWORD;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  // Check HR Credentials
  if (username === 'hr' && hrPassword) {
     const isHRPwdMatch = password.length === hrPassword.length &&
       crypto.timingSafeEqual(Buffer.from(password), Buffer.from(hrPassword));
     if (isHRPwdMatch) {
       const token = generateToken({ username: 'hr', role: 'hr' });
       return res.json({ token, role: 'hr', success: true });
     }
  }

  // Check Standard Credentials
  if (validUsername && validPassword) {
    const userMatch = username.length === validUsername.length &&
      crypto.timingSafeEqual(Buffer.from(username), Buffer.from(validUsername));
    const passMatch = password.length === validPassword.length &&
      crypto.timingSafeEqual(Buffer.from(password), Buffer.from(validPassword));

    if (userMatch && passMatch) {
      const token = generateToken({ username: validUsername, role: 'standard' });
      return res.json({ token, role: 'standard', success: true });
    }
  }
  
  return res.status(401).json({ error: "Invalid credentials" });
};

module.exports = { login };
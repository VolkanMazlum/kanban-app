const { generateToken } = require('./jwt');
const bcrypt = require('bcrypt');

const login = (query) => async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  try {
    // Look up user by email (username field maps to email column)
    const result = await query('SELECT * FROM users WHERE email = $1 AND is_active = TRUE', [username]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    // Compare bcrypt hash
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT with user identity
    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role.trim()
    });

    return res.json({
      token,
      role: user.role.trim(),
      name: user.name,
      success: true
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Server error during authentication" });
  }
};

module.exports = { login };
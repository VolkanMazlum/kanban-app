/**
 * Audit Logging Utility
 * Records destructive operations with the acting user's identity.
 */

async function logAudit(query, { userId, userUsername, userName, action, entityType, entityId, details, ip }) {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, user_username, user_name, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId || null, userUsername || null, userName || null, action, entityType, entityId || null, details ? JSON.stringify(details) : null, ip || null]
    );
  } catch (err) {
    // Never let audit logging break the main operation
    console.error("Audit log error:", err.message);
  }
}

/**
 * Extract audit context from the authenticated request.
 * Requires req.user to be set by auth middleware.
 */
function getAuditContext(req) {
  return {
    userId: req.user?.userId || null,
    userUsername: req.user?.username || null,
    userName: req.user?.name || null,
    ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null
  };
}

module.exports = { logAudit, getAuditContext };

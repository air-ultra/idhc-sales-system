const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

const authenticate = async (req, res, next) => {
  try {
    // Accept token from Authorization header OR ?t= query string (for <a> download links)
    const authHeader = req.headers.authorization;
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query.t) {
      token = req.query.t;
    }

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const result = await query(
      `SELECT u.id, u.username, u.email, u.staff_id, u.role_id,
              r.code as role_code, r.name as role_name,
              s.first_name_th, s.last_name_th, s.first_name_en, s.last_name_en,
              s.employee_code, s.profile_image
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN staff s ON u.staff_id = s.id
       WHERE u.id = $1 AND u.is_active = true`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const requirePermission = (module, action) => {
  return async (req, res, next) => {
    try {
      if (req.user.role_code === 'admin') return next();

      const result = await query(
        `SELECT 1 FROM role_permissions rp
         JOIN permissions p ON rp.permission_id = p.id
         WHERE rp.role_id = $1 AND p.module = $2 AND p.action = $3`,
        [req.user.role_id, module, action]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'Permission denied' });
      }
      next();
    } catch (err) {
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
};

module.exports = { authenticate, requirePermission };

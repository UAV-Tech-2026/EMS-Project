import jwt from "jsonwebtoken";
import pool from "../db.js";


const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key_change_this";
const EMS_JWT_SECRET = process.env.EMS_JWT_SECRET || JWT_SECRET;

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.query.token) {
    
    token = req.query.token;
  }

  if (!token) {
    console.warn(`[AuthMiddleware] No token provided for ${req.method} ${req.url}. IP: ${req.ip}`);
    return res.status(401).json({ msg: "No token provided" });
  }

  try {
   
    let decoded;
    try {
      decoded = jwt.verify(token, EMS_JWT_SECRET);
    } catch (firstErr) {
      if (firstErr.name === "TokenExpiredError") {
       
        console.warn(`[AuthMiddleware] Token EXPIRED for ${req.method} ${req.url} (exp: ${new Date(firstErr.expiredAt).toISOString()})`);
        return res.status(401).json({ msg: "Token expired", reason: "expired" });
      }
     
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (secondErr) {
        const reason = secondErr.name === "TokenExpiredError" ? "expired" : "invalid";
        console.error(`[AuthMiddleware] Token verification failed (both secrets) for ${req.method} ${req.url}: ${secondErr.message}`);
        return res.status(401).json({ msg: "Invalid token", reason });
      }
    }
    req.user = decoded;
    next();
  } catch (err) {
    console.error(`[AuthMiddleware] Token verification failed for ${req.method} ${req.url}:`, err.message);
    return res.status(401).json({ msg: "Invalid token" });
  }
};

export const isAdminOrSuper = (req, res, next) => {
  const role = req.user.role?.toLowerCase();
  if ((role && role.toLowerCase().replace(/[^a-z]/g, '') === "superadmin") || role === "admin") {
    next();
  } else {
    return res.status(403).json({ msg: "Access Denied: Requires Admin Privileges" });
  }
};

export const isSuperAdmin = (req, res, next) => {
  const role = req.user.role?.toLowerCase();
  if (role && role.toLowerCase().replace(/[^a-z]/g, '') === "superadmin") {
    next();
  } else {
    return res.status(403).json({ msg: "Access Denied: Requires Super Admin Privileges" });
  }
};

export const canWriteFeature = (featureName) => async (req, res, next) => {
  const role = req.user.role?.toLowerCase();
  if (role && role.toLowerCase().replace(/[^a-z]/g, '') === "superadmin") return next();
  try {
    const result = await pool.query(
      "SELECT can_write FROM user_permissions WHERE user_id = $1 AND feature_name = $2",
      [req.user.id, featureName]
    );
    if (result.rows.length === 0 || !result.rows[0].can_write) {
      return res.status(403).json({ msg: `Write access denied for feature: ${featureName}` });
    }
    next();
  } catch (err) {
    console.error("[canWriteFeature] DB error:", err);
    return res.status(500).json({ msg: "Server error checking permissions" });
  }
};

export const canReadFeature = (featureName) => async (req, res, next) => {
  const role = req.user.role?.toLowerCase();
  if (role && role.toLowerCase().replace(/[^a-z]/g, '') === "superadmin") return next();
  try {
    const result = await pool.query(
      "SELECT can_read FROM user_permissions WHERE user_id = $1 AND feature_name = $2",
      [req.user.id, featureName]
    );
    if (result.rows.length === 0 || !result.rows[0].can_read) {
      return res.status(403).json({ msg: `Read access denied for feature: ${featureName}` });
    }
    next();
  } catch (err) {
    console.error("[canReadFeature] DB error:", err);
    return res.status(500).json({ msg: "Server error checking permissions" });
  }
};


export const isHRDept = isAdminOrSuper;
export const isProductionAdmin = isAdminOrSuper;
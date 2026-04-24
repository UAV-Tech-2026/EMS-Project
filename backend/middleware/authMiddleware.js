import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key_change_this";

export const verifyToken = (req, res, next) => {
  // Check Authorization header first, then fallback to query param 'token'
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    console.log(`[Auth] No token provided for ${req.method} ${req.url}`);
    return res.status(401).json({ msg: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ msg: "Invalid token" });
  }
};

// Both admin and super_admin pass this check
export const isAdminOrSuper = (req, res, next) => {
  const role = req.user.role?.toLowerCase();
  if (role === "super_admin" || role === "admin" || role === "admin_hr") {
    next();
  } else {
    return res.status(403).json({ msg: "Access Denied: Requires Admin Privileges" });
  }
};

// Strictly only super_admin passes this check
export const isSuperAdmin = (req, res, next) => {
  const role = req.user.role?.toLowerCase();
  if (role === "super_admin") {
    next();
  } else {
    return res.status(403).json({ msg: "Access Denied: Requires Super Admin Privileges" });
  }
};
import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key_change_this";

export const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ msg: "No token provided" });

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
  if (role === "super_admin" || role === "admin") {
    next();
  } else {
    return res.status(403).json({ msg: "Access Denied: Requires Admin Privileges" });
  }
};
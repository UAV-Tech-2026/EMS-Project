export const securityHeaders = (req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");

  res.setHeader("X-Content-Type-Options", "nosniff");

  res.setHeader("X-XSS-Protection", "1; mode=block");

  res.removeHeader("X-Powered-By");

  next();
};


export const rateLimiter = () => {
  return (req, res, next) => {
    next();
  };
};

const ipLimits = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipLimits.entries()) {
    if (now > record.resetTime) {
      ipLimits.delete(ip);
    }
  }
}, 10 * 60 * 1000); 


export const securityHeaders = (req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");

  res.setHeader("X-Content-Type-Options", "nosniff");

  res.setHeader("X-XSS-Protection", "1; mode=block");

  res.removeHeader("X-Powered-By");

  next();
};


export const rateLimiter = (limitCount, windowMs) => {
  return (req, res, next) => {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || req.ip;
    const now = Date.now();

    if (!ipLimits.has(ip)) {
      ipLimits.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const record = ipLimits.get(ip);

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      return next();
    }

    record.count += 1;

    if (record.count > limitCount) {
      const remainingSecs = Math.ceil((record.resetTime - now) / 1000);
      console.warn(`[RateLimit] Brute force block on IP ${ip}. Remaining lock time: ${remainingSecs}s`);
      return res.status(429).json({
        msg: `Too many login attempts. Please try again after ${remainingSecs} seconds.`
      });
    }

    next();
  };
};

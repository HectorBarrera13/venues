/**
 * Checks whether an incoming origin is permitted.
 * Permits loopback addresses, same-host/IP requests, and origins listed in CORS_ALLOWED_ORIGINS.
 *
 * @param {string|undefined} origin
 * @param {import('express').Request} [req]
 * @returns {boolean}
 */
function isAllowedOrigin(origin, req) {
  if (!origin) {
    return true;
  }

  let originUrl;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  const originHostname = originUrl.hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');

  if (
    originHostname === 'localhost' ||
    originHostname === '127.0.0.1' ||
    originHostname === '::1'
  ) {
    return true;
  }

  if (req && req.headers && req.headers.host) {
    // Strip port and IPv6 brackets from incoming host header to compare host IP/hostname
    const hostHeader = req.headers.host.replace(/:\d+$/, '').toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
    if (originHostname === hostHeader) {
      return true;
    }
  }

  if (req && req.hostname) {
    const reqHostname = req.hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
    if (originHostname === reqHostname) {
      return true;
    }
  }

  if (process.env.CORS_ALLOWED_ORIGINS) {
    const allowedList = process.env.CORS_ALLOWED_ORIGINS.split(',').map((item) => item.trim().toLowerCase());
    if (allowedList.includes(origin.toLowerCase()) || allowedList.includes(originHostname)) {
      return true;
    }
  }

  return false;
}

/**
 * Express CORS middleware.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;

  if (origin) {
    if (!isAllowedOrigin(origin, req)) {
      return res.status(403).json({ error: 'CORS origin not allowed' });
    }

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      req.headers['access-control-request-headers'] || 'Content-Type, Authorization, Accept, X-Requested-With, Origin'
    );
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.sendStatus(204);
  }

  return next();
}

module.exports = corsMiddleware;
module.exports.corsMiddleware = corsMiddleware;
module.exports.isAllowedOrigin = isAllowedOrigin;

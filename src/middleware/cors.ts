import type { Request, RequestHandler } from 'express';

export function isAllowedOrigin(origin?: string | null, req?: Pick<Request, 'headers' | 'hostname'>): boolean {
  if (!origin) return true;

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  const originHostname = originUrl.hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
  if (['localhost', '127.0.0.1', '::1'].includes(originHostname)) return true;

  if (req?.headers?.host) {
    const hostHeader = req.headers.host.replace(/:\d+$/, '').toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
    if (originHostname === hostHeader) return true;
  }

  if (req?.hostname) {
    const reqHostname = req.hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
    if (originHostname === reqHostname) return true;
  }

  if (process.env.CORS_ALLOWED_ORIGINS) {
    const allowed = process.env.CORS_ALLOWED_ORIGINS.split(',').map((item) => item.trim().toLowerCase());
    if (allowed.includes(origin.toLowerCase()) || allowed.includes(originHostname)) return true;
  }

  return false;
}

export const corsMiddleware: RequestHandler = (req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    if (!isAllowedOrigin(origin, req)) {
      res.status(403).json({ error: 'CORS origin not allowed' });
      return;
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers',
      req.headers['access-control-request-headers'] || 'Content-Type, Authorization, Accept, X-Requested-With, Origin');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.sendStatus(204);
    return;
  }

  next();
};

export default corsMiddleware;

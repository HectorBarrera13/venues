import type { ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  const candidate = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const status = Number(candidate.statusCode || candidate.status || 500);
  const message = typeof candidate.message === 'string' && candidate.message
    ? candidate.message
    : 'Internal Server Error';
  res.status(status).json({ error: message });
};

export default errorHandler;

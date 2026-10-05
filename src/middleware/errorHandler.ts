import type { ErrorRequestHandler } from 'express';
import ApiError from '../errors/ApiError';

/**
 * Maps any thrown value onto the HTTP status and message the client must observe.
 * `ApiError` carries its own status; errors raised by third-party code (Prisma,
 * body parsers, ...) may expose `status` or `statusCode`, and anything unknown
 * degrades to 500 without leaking internals.
 */
export function toHttpError(error: unknown): { status: number; message: string } {
  if (error instanceof ApiError) {
    return { status: error.status, message: error.message };
  }

  const candidate = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
  const rawStatus = candidate.status ?? candidate.statusCode;
  const status = typeof rawStatus === 'number' && rawStatus >= 400 && rawStatus <= 599 ? rawStatus : 500;

  const message =
    status === 500 && !(error instanceof Error)
      ? 'Internal Server Error'
      : typeof candidate.message === 'string' && candidate.message
        ? candidate.message
        : 'Internal Server Error';

  return { status, message };
}

/**
 * Single place where an error becomes an HTTP response.
 * Controllers only forward errors here.
 */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const { status, message } = toHttpError(error);
  res.status(status).json({ error: message });
};

export default errorHandler;
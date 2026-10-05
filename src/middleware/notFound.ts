import type { RequestHandler } from 'express';
import ApiError from '../errors/ApiError';

/**
 * Answers any request that matched no route with the same error body shape
 * produced by `errorHandler`. Mounted after every router and before it.
 */
export const notFound: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

export default notFound;
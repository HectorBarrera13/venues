import type { FieldError } from '../entities/Venue';

/** Extra top-level fields rendered next to `error`, e.g. `existingVenueId` or `errors`. */
export type ApiErrorDetails = Record<string, unknown>;

/**
 * Error carrying the HTTP status the client must observe.
 * The error response body is rendered exclusively by `src/middleware/errorHandler.ts`
 * as `{ error: message, ...details }`.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly details?: ApiErrorDetails;

  constructor(status = 500, message = 'Internal Server Error', details?: ApiErrorDetails) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
    if (details) this.details = details;
  }

  static badRequest(message = 'Bad Request'): ApiError {
    return new ApiError(400, message);
  }

  /**
   * 400 listing every invalid field. `field`/`message` repeat the first error so clients
   * that bind a single field (the Backstage form) keep working; `errors` has all of them.
   */
  static validation(errors: FieldError[], message = 'Invalid venue data'): ApiError {
    const [first] = errors;
    return new ApiError(400, message, { field: first?.field, message: first?.message, errors });
  }

  static unauthorized(message = 'Unauthorized'): ApiError {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Forbidden'): ApiError {
    return new ApiError(403, message);
  }

  static notFound(message = 'Not Found'): ApiError {
    return new ApiError(404, message);
  }

  static conflict(message = 'Conflict', details?: ApiErrorDetails): ApiError {
    return new ApiError(409, message, details);
  }

  static unprocessable(message = 'Unprocessable Entity', details?: ApiErrorDetails): ApiError {
    return new ApiError(422, message, details);
  }

  static internal(message = 'Internal Server Error'): ApiError {
    return new ApiError(500, message);
  }

  static notImplemented(message = 'Not Implemented'): ApiError {
    return new ApiError(501, message);
  }
}

export default ApiError;

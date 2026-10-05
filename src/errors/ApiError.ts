/**
 * Error carrying the HTTP status the client must observe.
 * The error response body is rendered exclusively by `src/middleware/errorHandler.ts`.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status = 500, message = 'Internal Server Error') {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }

  static badRequest(message = 'Bad Request'): ApiError {
    return new ApiError(400, message);
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

  static internal(message = 'Internal Server Error'): ApiError {
    return new ApiError(500, message);
  }
}

export default ApiError;
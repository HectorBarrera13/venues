/**
 * ApiError
 *
 * Custom error class for known HTTP error responses.
 * Extends the native Error so it can be thrown normally and caught by
 * Express's error-handling middleware, which reads err.status.
 *
 * Usage:
 *   throw new ApiError(400, 'Field "name" is required');
 *   throw new ApiError(403, 'Only venue owners can register venues');
 */
class ApiError extends Error {
  /**
   * @param {number} status  - HTTP status code (e.g. 400, 403, 404, 500)
   * @param {string} message - Human-readable error description
   */
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

module.exports = ApiError;

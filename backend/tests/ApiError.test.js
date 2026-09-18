const ApiError = require('../src/errors/ApiError');
const { ApiError: NamedApiError } = require('../src/errors/ApiError');

describe('ApiError (Task 7)', () => {
  it('should export ApiError as default and named export', () => {
    expect(ApiError).toBeDefined();
    expect(NamedApiError).toBe(ApiError);
  });

  describe('constructor', () => {
    it('should set statusCode, status, message, and name with (statusCode, message)', () => {
      const err = new ApiError(400, 'Invalid request');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(400);
      expect(err.status).toBe(400);
      expect(err.message).toBe('Invalid request');
      expect(err.name).toBe('ApiError');
    });

    it('should set statusCode, status, and message with (message, statusCode)', () => {
      const err = new ApiError('Not found item', 404);
      expect(err.statusCode).toBe(404);
      expect(err.status).toBe(404);
      expect(err.message).toBe('Not found item');
    });

    it('should default statusCode to 500 and message to Internal Server Error', () => {
      const err = new ApiError();
      expect(err.statusCode).toBe(500);
      expect(err.status).toBe(500);
      expect(err.message).toBe('Internal Server Error');
      expect(err.name).toBe('ApiError');
    });

    it('should default statusCode to 500 if only message is provided as first argument', () => {
      const err = new ApiError('Something broke');
      expect(err.statusCode).toBe(500);
      expect(err.status).toBe(500);
      expect(err.message).toBe('Something broke');
    });
  });

  describe('static factory methods', () => {
    it('badRequest should return an ApiError with status 400', () => {
      const errDefault = ApiError.badRequest();
      expect(errDefault.statusCode).toBe(400);
      expect(errDefault.message).toBe('Bad Request');

      const errCustom = ApiError.badRequest('Missing email');
      expect(errCustom.statusCode).toBe(400);
      expect(errCustom.message).toBe('Missing email');
    });

    it('forbidden should return an ApiError with status 403', () => {
      const errDefault = ApiError.forbidden();
      expect(errDefault.statusCode).toBe(403);
      expect(errDefault.message).toBe('Forbidden');

      const errCustom = ApiError.forbidden('Access denied');
      expect(errCustom.statusCode).toBe(403);
      expect(errCustom.message).toBe('Access denied');
    });

    it('notFound should return an ApiError with status 404', () => {
      const errDefault = ApiError.notFound();
      expect(errDefault.statusCode).toBe(404);
      expect(errDefault.message).toBe('Not Found');

      const errCustom = ApiError.notFound('Venue not found');
      expect(errCustom.statusCode).toBe(404);
      expect(errCustom.message).toBe('Venue not found');
    });

    it('internal should return an ApiError with status 500', () => {
      const errDefault = ApiError.internal();
      expect(errDefault.statusCode).toBe(500);
      expect(errDefault.message).toBe('Internal Server Error');

      const errCustom = ApiError.internal('Database error');
      expect(errCustom.statusCode).toBe(500);
      expect(errCustom.message).toBe('Database error');
    });
  });
});

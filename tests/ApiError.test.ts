const ApiError = require('../src/errors/ApiError').default;
const { ApiError: NamedApiError } = require('../src/errors/ApiError');

describe('ApiError', () => {
  it('should export ApiError as default and named export', () => {
    expect(ApiError).toBeDefined();
    expect(NamedApiError).toBe(ApiError);
  });

  describe('constructor', () => {
    it('should set status, message and name with (status, message)', () => {
      const err = new ApiError(400, 'Invalid request');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(400);
      expect(err.message).toBe('Invalid request');
      expect(err.name).toBe('ApiError');
    });

    it('should default status to 500 and message to Internal Server Error', () => {
      const err = new ApiError();
      expect(err.status).toBe(500);
      expect(err.message).toBe('Internal Server Error');
      expect(err.name).toBe('ApiError');
    });
  });

  describe('static factory methods', () => {
    it('badRequest should return an ApiError with status 400', () => {
      const errDefault = ApiError.badRequest();
      expect(errDefault.status).toBe(400);
      expect(errDefault.message).toBe('Bad Request');

      const errCustom = ApiError.badRequest('Missing email');
      expect(errCustom.status).toBe(400);
      expect(errCustom.message).toBe('Missing email');
    });

    it('unauthorized should return an ApiError with status 401', () => {
      const errDefault = ApiError.unauthorized();
      expect(errDefault.status).toBe(401);
      expect(errDefault.message).toBe('Unauthorized');

      const errCustom = ApiError.unauthorized('Token expired');
      expect(errCustom.status).toBe(401);
      expect(errCustom.message).toBe('Token expired');
    });

    it('forbidden should return an ApiError with status 403', () => {
      const errDefault = ApiError.forbidden();
      expect(errDefault.status).toBe(403);
      expect(errDefault.message).toBe('Forbidden');

      const errCustom = ApiError.forbidden('Access denied');
      expect(errCustom.status).toBe(403);
      expect(errCustom.message).toBe('Access denied');
    });

    it('notFound should return an ApiError with status 404', () => {
      const errDefault = ApiError.notFound();
      expect(errDefault.status).toBe(404);
      expect(errDefault.message).toBe('Not Found');

      const errCustom = ApiError.notFound('Venue not found');
      expect(errCustom.status).toBe(404);
      expect(errCustom.message).toBe('Venue not found');
    });

    it('internal should return an ApiError with status 500', () => {
      const errDefault = ApiError.internal();
      expect(errDefault.status).toBe(500);
      expect(errDefault.message).toBe('Internal Server Error');

      const errCustom = ApiError.internal('Database error');
      expect(errCustom.status).toBe(500);
      expect(errCustom.message).toBe('Database error');
    });
  });
});

export {};
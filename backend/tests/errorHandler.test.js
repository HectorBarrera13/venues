const errorHandler = require('../src/middleware/errorHandler');
const { errorHandler: namedErrorHandler } = require('../src/middleware/errorHandler');
const ApiError = require('../src/errors/ApiError');

describe('errorHandler Middleware (Task 7)', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('should export errorHandler as default and named export', () => {
    expect(errorHandler).toBeDefined();
    expect(namedErrorHandler).toBe(errorHandler);
  });

  it('should respond with ApiError status code and error message', () => {
    const error = ApiError.badRequest('Invalid venue name');

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid venue name' });
  });

  it('should handle 403 Forbidden ApiError', () => {
    const error = ApiError.forbidden('User is not venue owner');

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'User is not venue owner' });
  });

  it('should handle error with custom status property', () => {
    const error = new Error('Not Allowed');
    error.status = 405;

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not Allowed' });
  });

  it('should default status to 500 when error has no statusCode or status', () => {
    const error = new Error('Database connection failed');

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Database connection failed' });
  });

  it('should fallback to Internal Server Error when error has no message', () => {
    const error = { statusCode: 500, message: '' };

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
  });
});

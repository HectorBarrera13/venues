import type { Request, Response, RequestHandler } from 'express';
import { createAuthenticate } from '../src/middleware/authenticate';
import type { TokenVerifier } from '../src/auth/TokenVerifier';
import type { AuthenticatedPrincipal } from '../src/auth/AuthenticatedPrincipal';

describe('authenticate middleware', () => {
  let mockVerifier: TokenVerifier;
  let authenticate: RequestHandler;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    mockVerifier = {
      verify: jest.fn(),
    };
    authenticate = createAuthenticate(mockVerifier);
    req = {
      headers: {},
    };
    res = {
      setHeader: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('should return 401 when Authorization header is missing', async () => {
    await authenticate(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith('WWW-Authenticate', 'Bearer');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing Authorization header' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when Authorization header is empty', async () => {
    req.headers = { authorization: '' };

    await authenticate(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith('WWW-Authenticate', 'Bearer');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing Authorization header' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when Authorization header uses non-Bearer scheme (e.g. Basic)', async () => {
    req.headers = { authorization: 'Basic dXNlcjpwYXNz' };

    await authenticate(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith('WWW-Authenticate', 'Bearer');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authorization header must use Bearer scheme' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when Bearer token is empty or whitespace', async () => {
    req.headers = { authorization: 'Bearer   ' };

    await authenticate(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith('WWW-Authenticate', 'Bearer');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Bearer token is missing or empty' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when token verification fails (malformed/invalid signature)', async () => {
    req.headers = { authorization: 'Bearer malformed.jwt.token' };
    (mockVerifier.verify as jest.Mock).mockRejectedValue(new Error('Invalid token structure'));

    await authenticate(req as Request, res as Response, next);

    expect(mockVerifier.verify).toHaveBeenCalledWith('malformed.jwt.token');
    expect(res.setHeader).toHaveBeenCalledWith('WWW-Authenticate', 'Bearer');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token structure' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should set req.auth and call next() when token is valid', async () => {
    const principal: AuthenticatedPrincipal = {
      userId: 'valid-user-123',
      roles: ['VENUE_OWNER'],
    };
    req.headers = { authorization: 'Bearer valid.jwt.token' };
    (mockVerifier.verify as jest.Mock).mockResolvedValue(principal);

    await authenticate(req as Request, res as Response, next);

    expect(mockVerifier.verify).toHaveBeenCalledWith('valid.jwt.token');
    expect(req.auth).toEqual(principal);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

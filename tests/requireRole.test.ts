import type { Request, Response } from 'express';
import { requireRole } from '../src/middleware/requireRole';
import { Roles } from '../src/auth/roles';

describe('requireRole middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    req = {};
    res = {
      setHeader: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('should return 401 if req.auth is not present', () => {
    const middleware = requireRole(Roles.VENUE_OWNER);
    middleware(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith('WWW-Authenticate', 'Bearer');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 when principal has ORGANIZER role instead of VENUE_OWNER', () => {
    req.auth = { userId: 'org-1', roles: [Roles.ORGANIZER] };
    const middleware = requireRole(Roles.VENUE_OWNER);
    middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 when principal has FAN role instead of VENUE_OWNER', () => {
    req.auth = { userId: 'fan-1', roles: [Roles.FAN] };
    const middleware = requireRole(Roles.VENUE_OWNER);
    middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 when principal has an unknown role', () => {
    req.auth = { userId: 'user-unknown', roles: ['SOME_OTHER_ROLE'] };
    const middleware = requireRole(Roles.VENUE_OWNER);
    middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() when principal contains the required VENUE_OWNER role', () => {
    req.auth = { userId: 'owner-1', roles: [Roles.VENUE_OWNER] };
    const middleware = requireRole(Roles.VENUE_OWNER);
    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should call next() when principal has multiple roles including VENUE_OWNER', () => {
    req.auth = { userId: 'super-1', roles: [Roles.ORGANIZER, Roles.VENUE_OWNER] };
    const middleware = requireRole(Roles.VENUE_OWNER);
    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

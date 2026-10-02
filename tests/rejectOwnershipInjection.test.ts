import type { Request, Response } from 'express';
import { rejectOwnershipInjection } from '../src/middleware/rejectOwnershipInjection';

describe('rejectOwnershipInjection middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('should return 400 when body contains ownerId', () => {
    req.body = {
      name: 'Arena CDMX',
      ownerId: 'injected-owner-id',
    };

    rejectOwnershipInjection(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Injecting ownerId or authorId is not allowed' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 400 when body contains authorId', () => {
    req.body = {
      name: 'Arena CDMX',
      authorId: 'injected-author-id',
    };

    rejectOwnershipInjection(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Injecting ownerId or authorId is not allowed' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 400 when body contains both ownerId and authorId', () => {
    req.body = {
      name: 'Arena CDMX',
      ownerId: 'id-1',
      authorId: 'id-2',
    };

    rejectOwnershipInjection(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Injecting ownerId or authorId is not allowed' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() when body does not contain ownerId or authorId', () => {
    req.body = {
      name: 'Arena CDMX',
      description: 'Major arena',
      location: 'Azcapotzalco',
    };

    rejectOwnershipInjection(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should call next() when body is undefined or null', () => {
    req.body = undefined;

    rejectOwnershipInjection(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

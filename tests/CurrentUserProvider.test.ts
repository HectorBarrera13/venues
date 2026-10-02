import { StubCurrentUserProvider } from '../src/providers/CurrentUserProvider';
import type { Request } from 'express';

function fakeReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

describe('StubCurrentUserProvider', () => {
  let provider: StubCurrentUserProvider;

  beforeEach(() => {
    provider = new StubCurrentUserProvider();
  });

  it('returns fixed user when no headers are present', () => {
    const user = provider.getCurrentUser(fakeReq());
    expect(user).toEqual({ userId: 'stub-owner-1', name: 'Stub Owner', role: 'venue_owner' });
  });

  it('uses x-user-id header when present', () => {
    const user = provider.getCurrentUser(fakeReq({ 'x-user-id': 'hdr-99' }));
    expect(user?.userId).toBe('hdr-99');
  });

  it('uses x-user-role header when present', () => {
    const user = provider.getCurrentUser(fakeReq({ 'x-user-id': 'hdr-99', 'x-user-role': 'organizer' }));
    expect(user?.role).toBe('organizer');
  });

  it('uses x-user-name header when present', () => {
    const user = provider.getCurrentUser(fakeReq({ 'x-user-id': 'hdr-99', 'x-user-name': 'Alice' }));
    expect(user?.name).toBe('Alice');
  });

  it('role and name are undefined when only x-user-id is set', () => {
    const user = provider.getCurrentUser(fakeReq({ 'x-user-id': 'hdr-99' }));
    expect(user?.role).toBeUndefined();
    expect(user?.name).toBeUndefined();
  });
});

export {};

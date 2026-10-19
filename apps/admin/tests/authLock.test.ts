import { afterEach, describe, expect, it, vi } from 'vitest';
import { authLock } from '../src/authLock';

afterEach(() => vi.unstubAllGlobals());

describe('admin auth lock', () => {
  it('skips a busy refresh without rejecting the browser lock callback', async () => {
    const operation = vi.fn();
    const request = vi.fn(async (_name, _options, callback) => {
      const outcome = callback(null);
      await expect(outcome).resolves.toEqual({ status: 'unavailable' });
      return outcome;
    });
    vi.stubGlobal('navigator', { locks: { request } });

    await expect(authLock('lock:wafou-admin-auth', 0, operation)).rejects.toMatchObject({ isAcquireTimeout: true });
    expect(operation).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith('lock:wafou-admin-auth', { mode: 'exclusive', ifAvailable: true }, expect.any(Function));
  });

  it('runs a refresh only while the browser grants the lock', async () => {
    let held = false;
    vi.stubGlobal('navigator', { locks: { request: async (_name: string, _options: LockOptions, callback: LockGrantedCallback<unknown>) => {
      held = true;
      try { return await callback({ name: 'lock:wafou-admin-auth', mode: 'exclusive' }); }
      finally { held = false; }
    } } });

    await expect(authLock('lock:wafou-admin-auth', 0, async () => {
      expect(held).toBe(true);
      return 'refreshed';
    })).resolves.toBe('refreshed');
    expect(held).toBe(false);
  });

  it('propagates operation failures after the browser callback resolves', async () => {
    const failure = new Error('refresh failed');
    vi.stubGlobal('navigator', { locks: { request: async (_name: string, _options: LockOptions, callback: LockGrantedCallback<unknown>) => {
      const outcome = callback({ name: 'lock:wafou-admin-auth', mode: 'exclusive' });
      await expect(outcome).resolves.toMatchObject({ status: 'failed', error: failure });
      return outcome;
    } } });

    await expect(authLock('lock:wafou-admin-auth', 0, async () => { throw failure; })).rejects.toBe(failure);
  });

  it('keeps normal auth requests queued with their timeout', async () => {
    const request = vi.fn(async (_name, _options, callback) => callback({ name: 'lock:wafou-admin-auth', mode: 'exclusive' }));
    vi.stubGlobal('navigator', { locks: { request } });

    await expect(authLock('lock:wafou-admin-auth', -1, async () => 'signed in')).resolves.toBe('signed in');
    expect(request).toHaveBeenCalledWith('lock:wafou-admin-auth', { mode: 'exclusive', signal: expect.any(AbortSignal) }, expect.any(Function));
  });
});

import { navigatorLock, NavigatorLockAcquireTimeoutError, processLock } from '@supabase/supabase-js';

export async function authLock<Result>(name: string, acquireTimeout: number, operation: () => Promise<Result>): Promise<Result> {
  if (typeof navigator === 'undefined' || !navigator.locks) return processLock(name, acquireTimeout, operation);
  if (acquireTimeout !== 0) return navigatorLock(name, acquireTimeout, operation);

  const outcome = await navigator.locks.request(name, { mode: 'exclusive', ifAvailable: true }, async lock => {
    if (!lock) return { status: 'unavailable' } as const;
    try {
      return { status: 'completed', value: await operation() } as const;
    } catch (error) {
      return { status: 'failed', error } as const;
    }
  });

  if (outcome.status === 'unavailable') throw new NavigatorLockAcquireTimeoutError(`Auth lock "${name}" is already held`);
  if (outcome.status === 'failed') throw outcome.error;
  return outcome.value;
}

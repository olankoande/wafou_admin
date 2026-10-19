import type { AuthProvider } from 'react-admin';
import type { AdminSession } from '@wafou/domain';
import { mayAccess } from '@wafou/domain';
import { supabase } from './supabase';

export async function adminSession(): Promise<AdminSession> {
  const { data, error } = await supabase.rpc('admin_session');
  if (error || !data?.permissions?.length) throw new Error('app.errors.accessDenied');
  return data as AdminSession;
}

export const authProvider: AuthProvider = {
  async login({ username, password }) {
    const { error } = await supabase.auth.signInWithPassword({ email: String(username).trim(), password });
    if (error) throw new Error('app.errors.loginFailed');
    try { await adminSession(); } catch (error) { await supabase.auth.signOut(); throw error; }
  },
  async logout() { await supabase.auth.signOut(); },
  async checkAuth() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error('app.errors.sessionExpired');
    await adminSession();
  },
  async checkError(error) {
    if (error?.status === 401) { await supabase.auth.signOut(); throw new Error('app.errors.sessionExpired'); }
  },
  async getIdentity() {
    const session = await adminSession();
    return { id: session.user_id, fullName: session.display_name || session.email };
  },
  async getPermissions() { return (await adminSession()).permissions; },
  async canAccess({ resource, action }) { return mayAccess((await adminSession()).permissions, resource ?? '', action); },
};

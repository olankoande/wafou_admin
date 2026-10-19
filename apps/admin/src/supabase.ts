import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { authLock } from './authLock';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
if (!url || !key || key === 'replace_with_public_anon_key') throw new Error('Missing public Supabase configuration. See apps/admin/.env.example.');
export const supabase = (import.meta.hot?.data.supabase as SupabaseClient | undefined) ?? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'wafou-admin-auth', lock: authLock },
});
if (import.meta.hot) import.meta.hot.data.supabase = supabase;

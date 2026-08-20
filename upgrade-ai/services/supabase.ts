// =============================================================================
// services/supabase.ts
// יצירת client יחיד (singleton) לסופאבייס — מיובא בכל מקום שצריך DB/Auth.
// המשתנים נקראים מ-.env.local ומוזרקים ב-build-time (prefix NEXT_PUBLIC_).
// DEV NOTE: אל תשתמשו ב-service_role key בצד הלקוח — רק ב-anonKey.
// =============================================================================
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
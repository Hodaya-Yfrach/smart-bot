
import { createClient } from '@supabase/supabase-js';

// את שני הערכים האלו את מעתיקה מה-Project Settings -> API בתוך Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
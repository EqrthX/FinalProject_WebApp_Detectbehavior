import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL_CLIENT;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_KEY_CLIENT

if(!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Missing Supabase environment variables!")
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
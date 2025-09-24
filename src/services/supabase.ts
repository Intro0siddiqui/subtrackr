// Use environment variables for Supabase credentials
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

console.log('🔧 Debug: Supabase configuration check');
console.log('🔧 Debug: Supabase URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
console.log('🔧 Debug: Supabase Anon Key:', supabaseAnonKey ? '✅ Set' : '❌ Missing');

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Debug: Supabase URL and Anon Key must be provided.');
    throw new Error("Supabase URL and Anon Key must be provided.");
}

console.log('🔧 Debug: Initializing Supabase client...');
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
console.log('✅ Debug: Supabase client initialized successfully');

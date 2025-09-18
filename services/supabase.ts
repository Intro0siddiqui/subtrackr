import { createClient } from '@supabase/supabase-js';

// Use the actual Supabase URL and Anon Key provided for the project.
const supabaseUrl = 'https://vgsfvvcjgxvariqmpnwg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnc2Z2dmNqZ3h2YXJpcW1wbndnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxMjg3NjQsImV4cCI6MjA3MzcwNDc2NH0.sU4VIlkWrEnDrK7kRVKiVcgVNR0JPRGwfJ0CEezb61A';

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase URL and Anon Key must be provided.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
// Supabase configuration
// Replace these with your actual Supabase project credentials
const SUPABASE_URL = 'https://ihlaqbgijgkqknpppbwu.supabase.co'; // e.g., https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = 'sb_publishable_ZMFCFALrOCvX8E82cTyu2A_A1FMRgxS';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
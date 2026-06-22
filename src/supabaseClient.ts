import { createClient } from "@supabase/supabase-js";

console.log("URL =", import.meta.env.VITE_SUPABASE_URL);
console.log("KEY =", import.meta.env.VITE_SUPABASE_ANON_KEY);

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLIC_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(
  SUPABASE_URL!,
  SUPABASE_PUBLIC_KEY!
);
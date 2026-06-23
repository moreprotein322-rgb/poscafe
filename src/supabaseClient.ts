import { createClient } from "@supabase/supabase-js";

// WARNING: Hardcoding API keys in frontend code is generally not recommended for security reasons.
// However, per explicit instructions to "Do NOT use environment variables", they are included here directly.
// Note: Supabase Anon keys are designed to have public visibility but must be paired with secure Row Level Security (RLS) rules in your dashboard.
const SUPABASE_URL = "https://muiwxahhlkzfvfaaysot.supabase.co"; // URL updated to use root domain, stripping /rest/v1/ for standard initialization
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11aXd4YWhobGt6ZnZmYWF5c290Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxODU5MjYsImV4cCI6MjA5Nzc2MTkyNn0.Xc9GzayHr08ypoB5X43HcTlIfJD8YBl_NbRuDqZbsVU";

// Initialize Supabase Client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Verifies the connection to Supabase by making a lightweight request.
 * Displays success or error messages in the console.
 */
export const verifyConnection = async () => {
  try {
    // Attempting a simple fetch on a non-existent or dummy table purely to test network/auth reachability
    const { error, status } = await supabase.from('_connection_test').select('*').limit(1);
    
    // Status 0 or network failure indicates no connection
    if (status === 0 || error?.message === 'FetchError: Network request failed') {
        throw new Error('Supabase network connection failed');
    }
    
    console.log("✅ Supabase connection verified successfully.");
    return true;
  } catch (error) {
    console.error("❌ Supabase connection error:", error);
    return false;
  }
};

/**
 * Reusable function to create/insert data into a specific table
 * @param tableName Name of the table
 * @param payload Data object to insert
 * @returns inserted data or throws error
 */
export const dbInsert = async (tableName: string, payload: any) => {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .insert(payload)
      .select();

    if (error) throw error;
    console.log(`✅ Successfully inserted data into [${tableName}]`);
    return data;
  } catch (error) {
    console.error(`❌ Error inserting into [${tableName}]:`, error);
    throw error;
  }
};

/**
 * Reusable function to read data from a table
 * @param tableName Name of the table
 * @param match Query match conditions (optional, e.g. { id: 1 })
 * @returns array of data or throws error
 */
export const dbRead = async (tableName: string, match: Record<string, any> = {}) => {
  try {
    let query = supabase.from(tableName).select('*');
    
    if (Object.keys(match).length > 0) {
      query = query.match(match);
    }

    const { data, error } = await query;

    if (error) throw error;
    console.log(`✅ Successfully fetched data from [${tableName}]`);
    return data;
  } catch (error) {
    console.error(`❌ Error reading from [${tableName}]:`, error);
    throw error;
  }
};

/**
 * Reusable function to update data in a table
 * @param tableName Name of the table
 * @param payload Data to update
 * @param match Match conditions to identify which row to update
 * @returns updated data or throws error
 */
export const dbUpdate = async (tableName: string, payload: any, match: Record<string, any>) => {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .update(payload)
      .match(match)
      .select();

    if (error) throw error;
    console.log(`✅ Successfully updated data in [${tableName}]`);
    return data;
  } catch (error) {
    console.error(`❌ Error updating [${tableName}]:`, error);
    throw error;
  }
};

/**
 * Reusable function to delete data from a table
 * @param tableName Name of the table
 * @param match Match conditions to identify which row to delete
 * @returns deleted data or throws error
 */
export const dbDelete = async (tableName: string, match: Record<string, any>) => {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .delete()
      .match(match)
      .select();

    if (error) throw error;
    console.log(`✅ Successfully deleted data from [${tableName}]`);
    return data;
  } catch (error) {
    console.error(`❌ Error deleting from [${tableName}]:`, error);
    throw error;
  }
};
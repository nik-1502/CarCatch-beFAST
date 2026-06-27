import { SUPABASE_CONFIG } from "./config.js";

export let supabase = null;
let clientPromise = null;

export function getSupabaseClient() {
  if (!clientPromise) {
    clientPromise = import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")
      .then(({ createClient }) => {
        supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        });
        return supabase;
      })
      .catch((error) => {
        clientPromise = null;
        throw error;
      });
  }
  return clientPromise;
}

export async function getSupabaseSession() {
  const client = await getSupabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function onSupabaseAuthChange(callback) {
  const client = await getSupabaseClient();
  return client.auth.onAuthStateChange((event, session) => callback(event, session));
}

export async function signUpWithSupabase(email, password, username) {
  const client = await getSupabaseClient();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
  if (error) throw error;
  return data;
}

export async function signInWithSupabase(email, password) {
  const client = await getSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOutFromSupabase() {
  const client = await getSupabaseClient();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw error;
}

export async function loadSupabaseHighscores(userId) {
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from("highscores")
    .select("duration, layout, scores")
    .eq("user_id", userId);
  if (error) throw error;
  return data || [];
}

export async function saveSupabaseHighscores(userId, scoreGroups) {
  const client = await getSupabaseClient();
  const rows = [];
  for (const [duration, layouts] of Object.entries(scoreGroups)) {
    for (const [layout, scores] of Object.entries(layouts)) {
      rows.push({
        user_id: userId,
        duration: Number(duration),
        layout,
        scores,
        updated_at: new Date().toISOString(),
      });
    }
  }
  if (!rows.length) return;
  const { error } = await client.from("highscores").upsert(rows, { onConflict: "user_id,duration,layout" });
  if (error) throw error;
}

import { supabase } from "./supabase.js";

export let currentUser = null;
export let currentProfile = null;

const listeners = new Set();
export function onAuthChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

async function loadProfile(userId) {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return data;
}

export async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    currentProfile = await loadProfile(session.user.id);
  }

  supabase.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user ?? null;
    currentProfile = currentUser ? await loadProfile(currentUser.id) : null;
    listeners.forEach(fn => fn());
  });
}

export const isAdmin   = () => currentProfile?.role === "admin";
export const isCreator = () => ["creator","admin"].includes(currentProfile?.role);
export const isPremium = () => currentProfile?.premium === true;

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export async function signUp(email, password) {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
}
export async function signOut() {
  await supabase.auth.signOut();
}

import { supabase } from "./supabase.js";

export let currentUser = null;
export let currentProfile = null;

/* ---------------- listeners ---------------- */

const listeners = new Set();
export function onAuthChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  listeners.forEach((fn) => {
    try { fn(currentUser, currentProfile); } catch (e) { console.error(e); }
  });
}

/* ---------------- helpers ---------------- */

async function loadProfile(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("[auth] loadProfile error:", error);
    return null;
  }
  return data;
}

export const isLoggedIn = () => !!currentUser;
export const isAdmin    = () => currentProfile?.role === "admin";
export const isCreator  = () => ["creator", "admin"].includes(currentProfile?.role);
export const isPremium  = () => currentProfile?.premium === true;
export const isBanned   = () => currentProfile?.banned === true;

/* ---------------- init ---------------- */

export async function initAuth() {
  // 1. Initial session load
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) console.error("[auth] getSession:", error);

  if (session) {
    currentUser = session.user;
    currentProfile = await loadProfile(session.user.id);

    // Kick banned users immediately
    if (currentProfile?.banned) {
      await supabase.auth.signOut();
      currentUser = null;
      currentProfile = null;
      alert("Your account has been suspended.");
    }
  }

  // 2. React to any future auth change
  supabase.auth.onAuthStateChange(async (event, session) => {
    try {
      currentUser = session?.user ?? null;
      currentProfile = currentUser ? await loadProfile(currentUser.id) : null;

      if (currentProfile?.banned) {
        await supabase.auth.signOut();
        currentUser = null;
        currentProfile = null;
        alert("Your account has been suspended.");
      }

      emit();
    } catch (e) {
      console.error("[auth] onAuthStateChange:", e);
    }
  });

  emit();
}

/* ---------------- actions ---------------- */

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  // check ban right after login
  const profile = await loadProfile(data.user.id);
  if (profile?.banned) {
    await supabase.auth.signOut();
    throw new Error("Your account has been suspended.");
  }

  currentUser = data.user;
  currentProfile = profile;
  emit();
  return data.user;
}

export async function signUp(email, password, username) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username: username || email.split("@")[0] },
    },
  });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  await supabase.auth.signOut();
  currentUser = null;
  currentProfile = null;
  emit();
}

export async function refreshProfile() {
  if (!currentUser) return null;
  currentProfile = await loadProfile(currentUser.id);
  emit();
  return currentProfile;
}

/* ---------------- guards ---------------- */

/**
 * Ensure a route is allowed. Returns true if OK, false if we should stop rendering.
 * Automatically redirects on failure by rendering a message.
 */
export function requireAuth(el) {
  if (!isLoggedIn()) {
    el.innerHTML = `
      <div class="page">
        <p>You must be signed in. <a href="/login" data-link>Log in</a>.</p>
      </div>`;
    return false;
  }
  return true;
}

export function requireRole(el, roles) {
  if (!requireAuth(el)) return false;
  if (!roles.includes(currentProfile?.role)) {
    el.innerHTML = `
      <div class="page">
        <p>Access denied — requires role: ${roles.join(" or ")}.</p>
      </div>`;
    return false;
  }
  return true;
}

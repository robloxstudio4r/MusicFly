import { supabase } from "../supabase.js";
import {
  currentUser, currentProfile,
  isAdmin, isCreator, isPremium,
  signOut, onAuthChange,
} from "../auth.js";
import { playTrack } from "../player.js";

/* ============================================================
   RENDER
   ============================================================ */

export async function render() {
  const el = document.createElement("div");
  el.className = "page home";

  el.innerHTML = `
    <header class="topbar">
      <h1 class="brand">MusicFly</h1>
      <nav>
        <a href="/" data-link>Home</a>
        <a href="/search" data-link>Search</a>
        <a href="/library" data-link>Library</a>
        <a href="/premium" data-link>Premium</a>
      </nav>
      <div class="user-menu" id="user-menu"></div>
    </header>

    <section class="hero">
      <h2>Discover music</h2>
      <p>Fresh tracks from MusicFly creators.</p>
    </section>

    <section id="ad-slot" class="ad-slot-wrap"></section>

    <section class="section">
      <h3>Latest uploads</h3>
      <div id="track-grid" class="track-grid"></div>
    </section>

    <section class="section" id="liked-section" style="display:none">
      <h3>Liked by you</h3>
      <div id="liked-grid" class="track-grid"></div>
    </section>

    <section class="section" id="playlist-section" style="display:none">
      <h3>Your playlists</h3>
      <div id="playlist-grid" class="playlist-grid"></div>
    </section>
  `;

  renderUserMenu(el);

  // Re-render user menu if auth state changes while on this page
  const off = onAuthChange(() => renderUserMenu(el));
  el._cleanup = off;

  // Load everything in parallel
  await Promise.all([
    loadTracks(el),
    loadAds(el),
    currentUser ? loadLiked(el)    : Promise.resolve(),
    currentUser ? loadPlaylists(el): Promise.resolve(),
  ]);

  return el;
}

/* ============================================================
   USER MENU
   ============================================================ */

function renderUserMenu(el) {
  const box = el.querySelector("#user-menu");
  if (!box) return;
  box.innerHTML = "";

  if (!currentUser) {
    const a = document.createElement("a");
    a.href = "/login";
    a.dataset.link = "";
    a.className = "btn";
    a.textContent = "Log in";
    box.appendChild(a);
    return;
  }

  // profile chip
  const chip = document.createElement("div");
  chip.className = "user-chip";
  const name = currentProfile?.username ?? currentUser.email ?? "User";
  const badges = [];
  if (currentProfile?.verified) badges.push("✅");
  if (isPremium()) badges.push("★");
  if (isAdmin())   badges.push("🛡");
  else if (isCreator()) badges.push("🎵");

  chip.innerHTML = `<span class="name">${escapeHtml(name)}</span>
    <span class="badges">${badges.join(" ")}</span>`;
  box.appendChild(chip);

  // dropdown
  const menu = document.createElement("div");
  menu.className = "user-dropdown";
  const links = [];
  if (isCreator()) links.push({ href: "/creator",   label: "Creator Studio" });
  if (isPremium()) links.push({ href: "/developer", label: "Developer Portal" });
  if (isAdmin())   links.push({ href: "/admin",     label: "Admin Panel" });
  links.push({ href: "/library", label: "Library" });

  links.forEach(({ href, label }) => {
    const a = document.createElement("a");
    a.href = href;
    a.dataset.link = "";
    a.textContent = label;
    menu.appendChild(a);
  });

  const logout = document.createElement("button");
  logout.textContent = "Log out";
  logout.onclick = async () => {
    await signOut();
    location.reload();
  };
  menu.appendChild(logout);

  chip.onclick = () => menu.classList.toggle("open");
  chip.appendChild(menu);
}

/* ============================================================
   TRACK GRID
   ============================================================ */

async function loadTracks(el) {
  const grid = el.querySelector("#track-grid");
  grid.innerHTML = `<div class="loader">Loading…</div>`;

  const { data, error } = await supabase
    .from("tracks")
    .select("*, creator:profiles!tracks_creator_id_fkey(username, verified)")
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    grid.innerHTML = `<pre class="error">${escapeHtml(error.message)}</pre>`;
    return;
  }

  grid.innerHTML = "";
  if (!data?.length) {
    grid.innerHTML = "<p>No tracks yet. Be the first to upload!</p>";
    return;
  }

  data.forEach((t) => grid.appendChild(trackCard(t, data)));
}

function trackCard(track, list) {
  const card = document.createElement("div");
  card.className = "track-card";
  card.innerHTML = `
    <div class="cover" ${track.cover_path ? `style="background-image:url('${publicUrl("covers", track.cover_path)}')"` : ""}>
      <button class="play-overlay">▶</button>
    </div>
    <div class="meta">
      <strong class="title">${escapeHtml(track.title)}</strong>
      <span class="artist">${escapeHtml(track.artist)}${
        track.creator?.verified ? " ✅" : ""
      }</span>
    </div>
  `;

  card.querySelector(".play-overlay").onclick = (e) => {
    e.stopPropagation();
    playTrack(track, list);
  };

  // double-click plays too
  card.ondblclick = () => playTrack(track, list);

  return card;
}

function publicUrl(bucket, path) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/* ============================================================
   LIKED TRACKS
   ============================================================ */

async function loadLiked(el) {
  const section = el.querySelector("#liked-section");
  const grid = el.querySelector("#liked-grid");

  const { data, error } = await supabase
    .from("likes")
    .select("track_id, tracks(*, creator:profiles!tracks_creator_id_fkey(username, verified))")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error || !data?.length) return; // silently hide

  const tracks = data.map((row) => row.tracks).filter(Boolean);
  if (!tracks.length) return;

  section.style.display = "";
  tracks.forEach((t) => grid.appendChild(trackCard(t, tracks)));
}

/* ============================================================
   PLAYLISTS
   ============================================================ */

async function loadPlaylists(el) {
  const section = el.querySelector("#playlist-section");
  const grid = el.querySelector("#playlist-grid");

  const { data, error } = await supabase
    .from("playlists")
    .select("*")
    .eq("owner_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error || !data?.length) return;

  section.style.display = "";
  grid.innerHTML = "";

  // "create new" card
  const newCard = document.createElement("button");
  newCard.className = "playlist-card new";
  newCard.textContent = "+ New playlist";
  newCard.onclick = async () => {
    const name = prompt("Playlist name:");
    if (!name) return;
    const { error } = await supabase.from("playlists").insert({
      owner_id: currentUser.id,
      name,
    });
    if (error) return alert(error.message);
    loadPlaylists(el);
  };
  grid.appendChild(newCard);

  data.forEach((p) => {
    const card = document.createElement("a");
    card.className = "playlist-card";
    card.href = `/playlist?id=${p.id}`;
    card.dataset.link = "";
    card.textContent = p.name;
    grid.appendChild(card);
  });
}

/* ============================================================
   AD SLOT
   ============================================================ */

async function loadAds(el) {
  const wrap = el.querySelector("#ad-slot");
  const { data, error } = await supabase
    .from("ads").select("*")
    .eq("active", true)
    .limit(1);

  if (error || !data?.length) return;

  const ad = data[0];
  const link = document.createElement("a");
  link.className = "ad-slot";
  link.href = ad.link_url || "#";
  link.target = "_blank";
  link.rel = "noopener";
  link.innerHTML = `<img src="${publicUrl("ads", ad.image_path)}" alt="${escapeHtml(ad.title)}" />`;
  link.onclick = () => {
    supabase.rpc("bump_ad_click", { ad_id: ad.id }).catch(() => {});
  };
  wrap.appendChild(link);

  // count impression (ignore failure)
  supabase.rpc("bump_ad_impression", { ad_id: ad.id }).catch(() => {});
}

/* ============================================================
   UTIL
   ============================================================ */

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

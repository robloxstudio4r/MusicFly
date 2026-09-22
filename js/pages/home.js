import { supabase } from "../supabase.js";
import {
  currentUser, currentProfile,
  isAdmin, isCreator, isPremium,
  onAuthChange,
} from "../auth.js";
import { playTrack } from "../player.js";

/* ============================================================
   RENDER
   ============================================================ */

export async function render() {
  const el = document.createElement("div");
  el.className = "page home";

  el.innerHTML = `
    <section class="hero">
      <h2 id="greeting">Good ${greeting()}</h2>
      <p>Here's what's fresh on MusicFly today.</p>
    </section>

    <section class="quick-tiles" id="quick-tiles"></section>

    <section id="ad-slot" class="ad-slot-wrap"></section>

    <section class="section">
      <h3>
        <span>Latest uploads</span>
        <a href="/search" data-link class="muted">See all →</a>
      </h3>
      <div id="track-grid" class="track-grid"></div>
    </section>

    <section class="section" id="liked-section" style="display:none">
      <h3>
        <span>Liked by you</span>
        <a href="/library" data-link class="muted">Open library →</a>
      </h3>
      <div id="liked-grid" class="track-grid"></div>
    </section>

    <section class="section" id="playlist-section" style="display:none">
      <h3>
        <span>Your playlists</span>
        <a href="/library" data-link class="muted">Manage →</a>
      </h3>
      <div id="playlist-grid" class="playlist-grid"></div>
    </section>
  `;

  renderGreeting(el);
  renderQuickTiles(el);

  // Re-render user-specific bits if auth changes while on this page
  const off = onAuthChange(() => {
    renderGreeting(el);
    renderQuickTiles(el);
    if (currentUser) {
      loadLiked(el);
      loadPlaylists(el);
    }
  });
  el._cleanup = off;

  // Load in parallel
  await Promise.all([
    loadTracks(el),
    loadAds(el),
    currentUser ? loadLiked(el)     : Promise.resolve(),
    currentUser ? loadPlaylists(el) : Promise.resolve(),
  ]);

  return el;
}

/* ============================================================
   GREETING
   ============================================================ */

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}

function renderGreeting(el) {
  const h2 = el.querySelector("#greeting");
  if (!h2) return;
  const name = currentProfile?.username || currentUser?.email?.split("@")[0];
  h2.textContent = name
    ? `Good ${greeting()}, ${name}`
    : `Good ${greeting()}`;
}

/* ============================================================
   QUICK TILES  (Spotify-style "recently played" row)
   ============================================================ */

function renderQuickTiles(el) {
  const wrap = el.querySelector("#quick-tiles");
  if (!wrap) return;

  const tiles = [
    { href: "/search",   label: "Search music",  color: "#1db954", icon: "🔎" },
    { href: "/library",  label: "Your library",  color: "#7a5cff", icon: "♫"  },
    { href: "/premium",  label: "Go Premium",    color: "#ffb800", icon: "★"  },
  ];

  if (isCreator()) tiles.push({ href: "/creator",   label: "Creator Studio",   color: "#ff5c7a", icon: "🎙" });
  if (isPremium()) tiles.push({ href: "/developer", label: "Developer Portal", color: "#22c1c3", icon: "⌘"  });
  if (isAdmin())   tiles.push({ href: "/admin",     label: "Admin Panel",      color: "#e54545", icon: "🛡" });

  wrap.innerHTML = "";
  tiles.forEach((t) => {
    const a = document.createElement("a");
    a.href = t.href;
    a.dataset.link = "";
    a.className = "quick-tile";
    a.style.setProperty("--tile-color", t.color);
    a.innerHTML = `
      <span class="tile-ico">${t.icon}</span>
      <span class="tile-label">${escapeHtml(t.label)}</span>
      <span class="tile-arrow">→</span>
    `;
    wrap.appendChild(a);
  });
}

/* ============================================================
   TRACK GRID
   ============================================================ */

async function loadTracks(el) {
  const grid = el.querySelector("#track-grid");
  if (!grid) return;
  grid.innerHTML = skeletonGrid(6);

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
    grid.innerHTML = `<div class="empty-state">
      <h2>No tracks yet</h2>
      <p>Be the first to upload on MusicFly.</p>
      ${isCreator()
        ? `<a class="btn primary" href="/creator" data-link>Open Creator Studio</a>`
        : ""}
    </div>`;
    return;
  }

  data.forEach((t) => grid.appendChild(trackCard(t, data)));
}

/* ============================================================
   TRACK CARD
   ============================================================ */

function trackCard(track, list) {
  const card = document.createElement("div");
  card.className = "track-card";

  const cover = track.cover_path
    ? `style="background-image:url('${publicUrl("covers", track.cover_path)}')"`
    : "";

  card.innerHTML = `
    <div class="cover" ${cover}>
      <button class="play-overlay" title="Play" aria-label="Play">▶</button>
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
  card.ondblclick = () => playTrack(track, list);

  return card;
}

/* ============================================================
   LIKED TRACKS
   ============================================================ */

async function loadLiked(el) {
  const section = el.querySelector("#liked-section");
  const grid = el.querySelector("#liked-grid");
  if (!section || !grid || !currentUser) return;

  const { data, error } = await supabase
    .from("likes")
    .select("track_id, tracks(*, creator:profiles!tracks_creator_id_fkey(username, verified))")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error || !data?.length) {
    section.style.display = "none";
    return;
  }

  const tracks = data.map((r) => r.tracks).filter(Boolean);
  if (!tracks.length) {
    section.style.display = "none";
    return;
  }

  section.style.display = "";
  grid.innerHTML = "";
  tracks.forEach((t) => grid.appendChild(trackCard(t, tracks)));
}

/* ============================================================
   PLAYLISTS
   ============================================================ */

async function loadPlaylists(el) {
  const section = el.querySelector("#playlist-section");
  const grid = el.querySelector("#playlist-grid");
  if (!section || !grid || !currentUser) return;

  const { data, error } = await supabase
    .from("playlists")
    .select("*")
    .eq("owner_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    section.style.display = "none";
    return;
  }

  section.style.display = "";
  grid.innerHTML = "";

  // "+ New playlist" tile
  const newCard = document.createElement("button");
  newCard.type = "button";
  newCard.className = "playlist-card new";
  newCard.innerHTML = `<span>＋ New playlist</span>`;
  newCard.onclick = async () => {
    const name = prompt("Playlist name:");
    if (!name) return;
    const { error: insErr } = await supabase.from("playlists").insert({
      owner_id: currentUser.id,
      name,
    });
    if (insErr) return alert(insErr.message);
    loadPlaylists(el);
  };
  grid.appendChild(newCard);

  if (!data?.length) return;

  data.forEach((p) => {
    const card = document.createElement("a");
    card.href = `/playlist?id=${p.id}`;
    card.dataset.link = "";
    card.className = "playlist-card";
    card.innerHTML = `<span class="pl-name">${escapeHtml(p.name)}</span>`;
    grid.appendChild(card);
  });
}

/* ============================================================
   AD SLOT
   ============================================================ */

async function loadAds(el) {
  const wrap = el.querySelector("#ad-slot");
  if (!wrap) return;

  const { data, error } = await supabase
    .from("ads")
    .select("*")
    .eq("active", true)
    .limit(1);

  if (error || !data?.length) {
    wrap.style.display = "none";
    return;
  }

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

  supabase.rpc("bump_ad_impression", { ad_id: ad.id }).catch(() => {});
}

/* ============================================================
   UTIL
   ============================================================ */

function publicUrl(bucket, path) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

function skeletonGrid(n) {
  return Array.from({ length: n })
    .map(
      () => `
        <div class="track-card skeleton">
          <div class="cover"></div>
          <div class="meta">
            <div class="sk-line w70"></div>
            <div class="sk-line w40"></div>
          </div>
        </div>`
    )
    .join("");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

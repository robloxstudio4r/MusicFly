import { supabase } from "../supabase.js";
import { currentUser, currentProfile, onAuthChange } from "../auth.js";
import { playTrack } from "../player.js";

export async function render() {
  const el = document.createElement("div");
  el.className = "page library";

  if (!currentUser) {
    el.innerHTML = `
      <header class="topbar">
        <h1 class="brand">MusicFly</h1>
        <nav>
          <a href="/" data-link>Home</a>
          <a href="/search" data-link>Search</a>
        </nav>
      </header>
      <div class="empty-state">
        <h2>Your library</h2>
        <p>Please <a href="/login" data-link>sign in</a> to see your library.</p>
      </div>
    `;
    return el;
  }

  el.innerHTML = `
    <header class="topbar">
      <h1 class="brand">MusicFly</h1>
      <nav>
        <a href="/" data-link>Home</a>
        <a href="/search" data-link>Search</a>
        <a href="/library" data-link>Library</a>
      </nav>
    </header>

    <div class="tabs">
      <button data-tab="liked" class="active">Liked</button>
      <button data-tab="playlists">Playlists</button>
      <button data-tab="uploads">Uploads</button>
    </div>

    <div id="tab-body"></div>
  `;

  const body = el.querySelector("#tab-body");
  const tabs = el.querySelectorAll(".tabs button");

  const show = async (tab) => {
    tabs.forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    body.innerHTML = `<div class="loader">Loading…</div>`;
    if (tab === "liked")     await renderLiked(body);
    if (tab === "playlists") await renderPlaylists(body, el);
    if (tab === "uploads")   await renderUploads(body);
  };

  tabs.forEach((b) => (b.onclick = () => show(b.dataset.tab)));
  await show("liked");

  return el;
}

/* ---------------- Liked ---------------- */

async function renderLiked(body) {
  const { data, error } = await supabase
    .from("likes")
    .select("track_id, tracks(*, creator:profiles!tracks_creator_id_fkey(username, verified))")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) { body.innerHTML = `<pre class="error">${error.message}</pre>`; return; }

  const tracks = (data ?? []).map((r) => r.tracks).filter(Boolean);
  if (!tracks.length) {
    body.innerHTML = `<div class="empty-state"><p>You haven't liked anything yet.</p></div>`;
    return;
  }

  const grid = document.createElement("div");
  grid.className = "track-grid";
  tracks.forEach((t) => grid.appendChild(trackCard(t, tracks, "liked")));
  body.innerHTML = "";
  body.appendChild(grid);
}

/* ---------------- Playlists ---------------- */

async function renderPlaylists(body, pageEl) {
  const { data, error } = await supabase
    .from("playlists")
    .select("*")
    .eq("owner_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) { body.innerHTML = `<pre class="error">${error.message}</pre>`; return; }

  body.innerHTML = "";

  const top = document.createElement("div");
  top.className = "library-head";
  top.innerHTML = `<button class="btn" id="new-pl">+ New playlist</button>`;
  body.appendChild(top);

  top.querySelector("#new-pl").onclick = async () => {
    const name = prompt("Playlist name:");
    if (!name) return;
    const { error: insErr } = await supabase.from("playlists").insert({
      owner_id: currentUser.id,
      name,
    });
    if (insErr) return alert(insErr.message);
    renderPlaylists(body, pageEl);
  };

  const grid = document.createElement("div");
  grid.className = "playlist-grid";
  body.appendChild(grid);

  if (!data?.length) {
    const p = document.createElement("p");
    p.textContent = "No playlists yet.";
    body.appendChild(p);
    return;
  }

  data.forEach((p) => {
    const card = document.createElement("div");
    card.className = "playlist-card";
    card.innerHTML = `
      <a href="/playlist?id=${p.id}" data-link class="pl-name">${escapeHtml(p.name)}</a>
      <button class="del" title="Delete">✕</button>
    `;
    card.querySelector(".del").onclick = async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete playlist "${p.name}"?`)) return;
      const { error } = await supabase.from("playlists").delete().eq("id", p.id);
      if (error) return alert(error.message);
      card.remove();
    };
    grid.appendChild(card);
  });
}

/* ---------------- Uploads (creator) ---------------- */

async function renderUploads(body) {
  const { data, error } = await supabase
    .from("tracks")
    .select("*")
    .eq("creator_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) { body.innerHTML = `<pre class="error">${error.message}</pre>`; return; }

  if (!data?.length) {
    body.innerHTML = `<div class="empty-state">
      <p>No uploads yet.</p>
      <a class="btn" href="/creator" data-link>Open Creator Studio</a>
    </div>`;
    return;
  }

  body.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "track-grid";
  data.forEach((t) => grid.appendChild(trackCard(t, data, "upload")));
  body.appendChild(grid);
}

/* ---------------- Card ---------------- */

function trackCard(track, list, mode) {
  const card = document.createElement("div");
  card.className = "track-card";
  const cover = track.cover_path
    ? `style="background-image:url('${publicUrl("covers", track.cover_path)}')"`
    : "";
  const pub = track.published ? "" : `<span class="badge pending">pending</span>`;

  card.innerHTML = `
    <div class="cover" ${cover}>
      <button class="play-overlay">▶</button>
      ${pub}
      ${
        mode === "liked"
          ? `<button class="unlike" title="Unlike">♥</button>`
          : ""
      }
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

  const unlike = card.querySelector(".unlike");
  if (unlike) {
    unlike.onclick = async (e) => {
      e.stopPropagation();
      await supabase
        .from("likes")
        .delete()
        .eq("user_id", currentUser.id)
        .eq("track_id", track.id);
      card.remove();
    };
  }

  return card;
}

function publicUrl(bucket, path) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

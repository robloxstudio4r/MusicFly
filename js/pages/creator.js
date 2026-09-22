import { supabase } from "../supabase.js";
import { currentUser, isCreator } from "../auth.js";

export async function render() {
  const el = document.createElement("div");
  el.className = "page creator";

  if (!currentUser) { el.innerHTML = "<p><a href='/login' data-link>Sign in</a>.</p>"; return el; }
  if (!isCreator()) { el.innerHTML = "<p>No creator access.</p>"; return el; }

  el.innerHTML = `
    <header class="topbar"><h1>Creator Studio</h1><nav>
      <a href="/" data-link>Home</a>
    </nav></header>
    <div class="tabs">
      <button data-tab="music" class="active">Music</button>
      <button data-tab="ads">Ads</button>
    </div>
    <div id="tab-body"></div>
  `;

  const body = el.querySelector("#tab-body");
  const buttons = el.querySelectorAll(".tabs button");

  const showTab = (tab) => {
    buttons.forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    body.innerHTML = "";
    body.appendChild(tab === "music" ? musicTab() : adsTab());
  };

  buttons.forEach(b => b.onclick = () => showTab(b.dataset.tab));
  showTab("music");
  return el;
}

function musicTab() {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <h2>Upload Track</h2>
    <form id="upload-form">
      <input name="title" placeholder="Title" required />
      <input name="artist" placeholder="Artist" required />
      <input name="genre" placeholder="Genre" />
      <input type="file" name="audio" accept="audio/*" required />
      <input type="file" name="cover" accept="image/*" />
      <button type="submit">Upload</button>
    </form>
    <div id="status"></div>
    <h2>My Tracks</h2>
    <div id="my-tracks"></div>
  `;

  wrap.querySelector("#upload-form").onsubmit = async (e) => {
    e.preventDefault();
    const status = wrap.querySelector("#status");
    const fd = new FormData(e.target);
    const audioFile = fd.get("audio");
    const coverFile = fd.get("cover");

    status.textContent = "Uploading audio…";
    const audioPath = `${currentUser.id}/${Date.now()}-${audioFile.name}`;
    const { error: upErr } = await supabase.storage.from("music").upload(audioPath, audioFile);
    if (upErr) { status.textContent = upErr.message; return; }

    let coverPath = null;
    if (coverFile && coverFile.size) {
      coverPath = `${currentUser.id}/${Date.now()}-${coverFile.name}`;
      await supabase.storage.from("covers").upload(coverPath, coverFile);
    }

    status.textContent = "Saving…";
    const { error: insErr } = await supabase.from("tracks").insert({
      creator_id: currentUser.id,
      title: fd.get("title"), artist: fd.get("artist"),
      genre: fd.get("genre"), audio_path: audioPath,
      cover_path: coverPath, published: false,
    });
    status.textContent = insErr ? insErr.message : "Uploaded ✓";
    loadMyTracks(wrap);
  };

  loadMyTracks(wrap);
  return wrap;
}

async function loadMyTracks(wrap) {
  const { data } = await supabase.from("tracks").select("*").eq("creator_id", currentUser.id);
  const box = wrap.querySelector("#my-tracks");
  box.innerHTML = "";
  (data ?? []).forEach(t => {
    const row = document.createElement("div");
    row.className = "admin-track";
    row.innerHTML = `<span>${t.title} — ${t.artist}</span>
      <span>${t.published ? "✅ published" : "⏳ pending"}</span>
      <button>Delete</button>`;
    row.querySelector("button").onclick = async () => {
      await supabase.storage.from("music").remove([t.audio_path]);
      await supabase.from("tracks").delete().eq("id", t.id);
      row.remove();
    };
    box.appendChild(row);
  });
}

function adsTab() {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <h2>Create Ad</h2>
    <form id="ad-form">
      <input name="title" placeholder="Ad title" required />
      <input name="link_url" placeholder="https://target.com" type="url" />
      <input type="file" name="image" accept="image/*" required />
      <button type="submit">Create Ad</button>
    </form>
    <div id="ad-status"></div>
    <h2>My Ads</h2>
    <div id="my-ads"></div>
  `;

  wrap.querySelector("#ad-form").onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const img = fd.get("image");
    const status = wrap.querySelector("#ad-status");
    status.textContent = "Uploading…";

    const path = `${currentUser.id}/${Date.now()}-${img.name}`;
    const { error: upErr } = await supabase.storage.from("ads").upload(path, img);
    if (upErr) { status.textContent = upErr.message; return; }

    const { error } = await supabase.from("ads").insert({
      creator_id: currentUser.id,
      title: fd.get("title"),
      link_url: fd.get("link_url"),
      image_path: path,
      active: false,
    });
    status.textContent = error ? error.message : "Ad created ✓ (pending approval)";
    loadMyAds(wrap);
  };

  loadMyAds(wrap);
  return wrap;
}

async function loadMyAds(wrap) {
  const { data } = await supabase.from("ads").select("*").eq("creator_id", currentUser.id);
  const box = wrap.querySelector("#my-ads");
  box.innerHTML = "";
  (data ?? []).forEach(a => {
    const row = document.createElement("div");
    row.className = "admin-track";
    row.innerHTML = `<span>${a.title}</span>
      <span>${a.active ? "✅ active" : "⏳ pending"}</span>
      <span>${a.impressions ?? 0} impressions</span>
      <button>Delete</button>`;
    row.querySelector("button").onclick = async () => {
      await supabase.storage.from("ads").remove([a.image_path]);
      await supabase.from("ads").delete().eq("id", a.id);
      row.remove();
    };
    box.appendChild(row);
  });
}

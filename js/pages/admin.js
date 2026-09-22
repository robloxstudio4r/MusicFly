import { supabase } from "../supabase.js";
import { isAdmin, refreshProfile } from "../auth.js";

/* ============================================================
   RENDER
   ============================================================ */

export async function render() {
  const el = document.createElement("div");
  el.className = "page admin";

  if (!isAdmin()) {
    el.innerHTML = `
      <header class="topbar"><h1>Admin</h1>
        <nav><a href="/" data-link>Home</a></nav>
      </header>
      <p>Access denied.</p>`;
    return el;
  }

  el.innerHTML = `
    <header class="topbar">
      <h1>Admin Panel</h1>
      <nav>
        <a href="/" data-link>Home</a>
        <a href="/admin" data-link>Admin</a>
      </nav>
    </header>

    <section class="admin-section" id="sec-users">
      <div class="section-head">
        <h2>Users</h2>
        <input id="user-search" placeholder="Search email / username…" />
      </div>
      <table id="users-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Username</th>
            <th>Role</th>
            <th>Premium</th>
            <th>Banned</th>
            <th>Verified</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
      <div id="user-status" class="status"></div>
    </section>

    <section class="admin-section" id="sec-tracks">
      <div class="section-head">
        <h2>Tracks</h2>
        <input id="track-search" placeholder="Search title / artist…" />
      </div>
      <div id="all-tracks"></div>
    </section>

    <section class="admin-section" id="sec-ads">
      <div class="section-head">
        <h2>Ads</h2>
      </div>
      <div id="all-ads"></div>
    </section>
  `;

  await loadUsers(el);
  await loadTracks(el);
  await loadAds(el);

  el.querySelector("#user-search").oninput = debounce((e) => loadUsers(el, e.target.value), 300);
  el.querySelector("#track-search").oninput = debounce((e) => loadTracks(el, e.target.value), 300);

  return el;
}

/* ============================================================
   USERS
   ============================================================ */

async function loadUsers(el, q = "") {
  const tbody = el.querySelector("#users-table tbody");
  const status = el.querySelector("#user-status");
  tbody.innerHTML = `<tr><td colspan="7">Loading…</td></tr>`;
  status.textContent = "";

  let query = supabase.from("profiles").select("*");

  if (q) {
    // ilike on either email or username
    const safe = q.replace(/[%_]/g, "");
    query = query.or(`email.ilike.%${safe}%,username.ilike.%${safe}%`);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(200);

  if (error) {
    tbody.innerHTML = "";
    status.textContent = "Error: " + error.message;
    return;
  }

  tbody.innerHTML = "";
  if (!data?.length) {
    tbody.innerHTML = `<tr><td colspan="7">No users found.</td></tr>`;
    return;
  }

  for (const u of data) {
    const tr = document.createElement("tr");
    tr.dataset.id = u.id;
    tr.innerHTML = `
      <td>${escapeHtml(u.email ?? u.id.slice(0, 8))}</td>
      <td>${escapeHtml(u.username ?? "")}</td>
      <td>
        <select class="role-sel">
          ${["user", "creator", "admin"].map(r =>
            `<option value="${r}" ${u.role === r ? "selected" : ""}>${r}</option>`
          ).join("")}
        </select>
      </td>
      <td><input type="checkbox" class="prem-chk" ${u.premium ? "checked" : ""}></td>
      <td><input type="checkbox" class="ban-chk"  ${u.banned  ? "checked" : ""}></td>
      <td><input type="checkbox" class="ver-chk"  ${u.verified? "checked" : ""}></td>
      <td class="actions">
        <button class="grant-prem">Grant Premium</button>
        <button class="revoke-prem">Revoke Premium</button>
        <button class="del-btn danger">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  // --- change handlers ---
  tbody.querySelectorAll(".role-sel").forEach((sel) => {
    sel.onchange = async () => {
      const tr = sel.closest("tr");
      const id = tr.dataset.id;
      const { error } = await supabase.from("profiles").update({ role: sel.value }).eq("id", id);
      flash(status, error ? error.message : `Role → ${sel.value}`, !!error);
    };
  });

  tbody.querySelectorAll(".prem-chk").forEach((chk) => {
    chk.onchange = async () => {
      const id = chk.closest("tr").dataset.id;
      const { error } = await supabase.from("profiles").update({ premium: chk.checked }).eq("id", id);
      flash(status, error ? error.message : `Premium → ${chk.checked}`, !!error);
    };
  });

  tbody.querySelectorAll(".ban-chk").forEach((chk) => {
    chk.onchange = async () => {
      const id = chk.closest("tr").dataset.id;
      const { error } = await supabase.from("profiles").update({ banned: chk.checked }).eq("id", id);
      flash(status, error ? error.message : `Banned → ${chk.checked}`, !!error);
    };
  });

  tbody.querySelectorAll(".ver-chk").forEach((chk) => {
    chk.onchange = async () => {
      const id = chk.closest("tr").dataset.id;
      const { error } = await supabase.from("profiles").update({ verified: chk.checked }).eq("id", id);
      flash(status, error ? error.message : `Verified → ${chk.checked}`, !!error);
    };
  });

  // --- grant / revoke premium buttons ---
  tbody.querySelectorAll(".grant-prem").forEach((btn) => {
    btn.onclick = async () => {
      const tr = btn.closest("tr");
      const id = tr.dataset.id;
      const { error } = await supabase.from("profiles").update({ premium: true }).eq("id", id);
      if (!error) tr.querySelector(".prem-chk").checked = true;
      flash(status, error ? error.message : "Premium granted", !!error);
    };
  });

  tbody.querySelectorAll(".revoke-prem").forEach((btn) => {
    btn.onclick = async () => {
      const tr = btn.closest("tr");
      const id = tr.dataset.id;
      const { error } = await supabase.from("profiles").update({ premium: false }).eq("id", id);
      if (!error) tr.querySelector(".prem-chk").checked = false;
      flash(status, error ? error.message : "Premium revoked", !!error);
    };
  });

  tbody.querySelectorAll(".del-btn").forEach((btn) => {
    btn.onclick = async () => {
      const tr = btn.closest("tr");
      const id = tr.dataset.id;
      if (!confirm("Delete this user's profile? (auth user is not removed)")) return;
      const { error } = await supabase.from("profiles").delete().eq("id", id);
      if (error) return flash(status, error.message, true);
      tr.remove();
      flash(status, "User profile deleted", false);
    };
  });
}

/* ============================================================
   TRACKS
   ============================================================ */

async function loadTracks(el, q = "") {
  const wrap = el.querySelector("#all-tracks");
  wrap.innerHTML = "Loading…";

  let query = supabase.from("tracks").select("*");
  if (q) {
    const safe = q.replace(/[%_]/g, "");
    query = query.or(`title.ilike.%${safe}%,artist.ilike.%${safe}%`);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(200);

  if (error) { wrap.innerHTML = `<pre>${error.message}</pre>`; return; }

  wrap.innerHTML = "";
  if (!data?.length) { wrap.innerHTML = "<p>No tracks.</p>"; return; }

  for (const t of data) {
    const row = document.createElement("div");
    row.className = "admin-track";
    row.dataset.id = t.id;
    row.innerHTML = `
      <span class="t-title">${escapeHtml(t.title)}</span>
      <span class="t-artist">${escapeHtml(t.artist)}</span>
      <span class="t-genre">${escapeHtml(t.genre ?? "")}</span>
      <label><input type="checkbox" class="pub-chk" ${t.published ? "checked" : ""}> published</label>
      <button class="play-btn">▶</button>
      <button class="edit-btn">Edit</button>
      <button class="del-btn danger">Delete</button>
    `;

    row.querySelector(".pub-chk").onchange = async (e) => {
      const { error } = await supabase.from("tracks").update({ published: e.target.checked }).eq("id", t.id);
      if (error) alert(error.message);
    };

    row.querySelector(".play-btn").onclick = async () => {
      const { playTrack } = await import("../player.js");
      playTrack(t, [t]);
    };

    row.querySelector(".edit-btn").onclick = async () => {
      const title  = prompt("Title:",  t.title);  if (title  === null) return;
      const artist = prompt("Artist:", t.artist); if (artist === null) return;
      const genre  = prompt("Genre:",  t.genre ?? ""); if (genre === null) return;

      const { error } = await supabase
        .from("tracks")
        .update({ title, artist, genre })
        .eq("id", t.id);

      if (error) return alert(error.message);
      row.querySelector(".t-title").textContent = title;
      row.querySelector(".t-artist").textContent = artist;
      row.querySelector(".t-genre").textContent = genre;
    };

    row.querySelector(".del-btn").onclick = async () => {
      if (!confirm(`Delete "${t.title}"?`)) return;
      try {
        if (t.audio_path) await supabase.storage.from("music").remove([t.audio_path]);
        if (t.cover_path) await supabase.storage.from("covers").remove([t.cover_path]);
      } catch (e) { console.warn("Storage delete failed:", e); }
      const { error } = await supabase.from("tracks").delete().eq("id", t.id);
      if (error) return alert(error.message);
      row.remove();
    };

    wrap.appendChild(row);
  }
}

/* ============================================================
   ADS
   ============================================================ */

async function loadAds(el) {
  const wrap = el.querySelector("#all-ads");
  wrap.innerHTML = "Loading…";

  const { data, error } = await supabase
    .from("ads").select("*")
    .order("created_at", { ascending: false }).limit(200);

  if (error) { wrap.innerHTML = `<pre>${error.message}</pre>`; return; }

  wrap.innerHTML = "";
  if (!data?.length) { wrap.innerHTML = "<p>No ads.</p>"; return; }

  for (const a of data) {
    const row = document.createElement("div");
    row.className = "admin-track";
    row.dataset.id = a.id;
    row.innerHTML = `
      <span>${escapeHtml(a.title ?? "(untitled)")}</span>
      <span>${a.impressions ?? 0} impressions</span>
      <label><input type="checkbox" class="active-chk" ${a.active ? "checked" : ""}> active</label>
      <button class="del-btn danger">Delete</button>
    `;

    row.querySelector(".active-chk").onchange = async (e) => {
      const { error } = await supabase.from("ads").update({ active: e.target.checked }).eq("id", a.id);
      if (error) alert(error.message);
    };

    row.querySelector(".del-btn").onclick = async () => {
      if (!confirm("Delete this ad?")) return;
      try {
        if (a.image_path) await supabase.storage.from("ads").remove([a.image_path]);
      } catch (e) { console.warn(e); }
      const { error } = await supabase.from("ads").delete().eq("id", a.id);
      if (error) return alert(error.message);
      row.remove();
    };

    wrap.appendChild(row);
  }
}

/* ============================================================
   UTIL
   ============================================================ */

function debounce(fn, ms = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function flash(el, msg, isError) {
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? "#f55" : "#1db954";
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.textContent = ""; }, 3000);
}

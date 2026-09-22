import { supabase } from "../supabase.js";
import { isAdmin } from "../auth.js";

export async function render() {
  const el = document.createElement("div");
  el.className = "page admin";
  if (!isAdmin()) { el.innerHTML = "<p>Access denied.</p>"; return el; }

  el.innerHTML = `
    <header class="topbar">
      <h1>Admin Panel</h1>
      <nav>
        <a href="/" data-link>Home</a>
        <a href="/admin" data-link>Admin</a>
      </nav>
    </header>

    <section class="admin-section">
      <h2>Users</h2>
      <input id="user-search" placeholder="Search by email or username…" />
      <table id="users-table">
        <thead><tr>
          <th>Email</th><th>Role</th><th>Premium</th><th>Banned</th><th>Verified</th><th>Actions</th>
        </tr></thead>
        <tbody></tbody>
      </table>
    </section>

    <section class="admin-section">
      <h2>All Tracks</h2>
      <input id="track-search" placeholder="Search tracks…" />
      <div id="all-tracks"></div>
    </section>

    <section class="admin-section">
      <h2>Ads</h2>
      <a href="/creator?tab=ads" data-link>Manage ads in Creator Studio →</a>
    </section>
  `;

  await loadUsers(el);
  await loadTracks(el);

  el.querySelector("#user-search").oninput = (e) => loadUsers(el, e.target.value);
  el.querySelector("#track-search").oninput = (e) => loadTracks(el, e.target.value);

  return el;
}

async function loadUsers(el, q = "") {
  let query = supabase.from("profiles").select("*");
  if (q) query = query.or(`email.ilike.%${q}%,username.ilike.%${q}%`);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) { console.error(error); return; }

  const tbody = el.querySelector("#users-table tbody");
  tbody.innerHTML = "";
  (data ?? []).forEach(u => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.email ?? u.id.slice(0,8)}</td>
      <td>
        <select data-id="${u.id}" class="role-sel">
          ${["user","creator","admin"].map(r =>
            `<option ${u.role===r?"selected":""}>${r}</option>`).join("")}
        </select>
      </td>
      <td><input type="checkbox" data-id="${u.id}" class="prem-chk" ${u.premium?"checked":""}></td>
      <td><input type="checkbox" data-id="${u.id}" class="ban-chk" ${u.banned?"checked":""}></td>
      <td><input type="checkbox" data-id="${u.id}" class="ver-chk" ${u.verified?"checked":""}></td>
      <td>
        <button data-id="${u.id}" class="del-btn">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.addEventListener("change", async (e) => {
    const id = e.target.dataset.id;
    if (!id) return;
    const update = {};
    if (e.target.classList.contains("role-sel"))  update.role     = e.target.value;
    if (e.target.classList.contains("prem-chk"))  update.premium  = e.target.checked;
    if (e.target.classList.contains("ban-chk"))   update.banned   = e.target.checked;
    if (e.target.classList.contains("ver-chk"))   update.verified = e.target.checked;

    const { error } = await supabase.from("profiles").update(update).eq("id", id);
    if (error) alert(error.message);

    // If banned, kill their session server-side isn't possible from client;
    // RLS blocks all reads so app becomes unusable for them.
  });

  tbody.addEventListener("click", async (e) => {
    if (e.target.classList.contains("del-btn")) {
      if (!confirm("Delete this user's profile?")) return;
      const { error } = await supabase.from("profiles").delete().eq("id", e.target.dataset.id);
      if (error) return alert(error.message);
      e.target.closest("tr").remove();
    }
  });
}

async function loadTracks(el, q = "") {
  let query = supabase.from("tracks").select("*");
  if (q) query = query.or(`title.ilike.%${q}%,artist.ilike.%${q}%`);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) { console.error(error); return; }

  const wrap = el.querySelector("#all-tracks");
  wrap.innerHTML = "";
  (data ?? []).forEach(t => {
    const row = document.createElement("div");
    row.className = "admin-track";
    row.innerHTML = `
      <span class="t-title">${t.title}</span>
      <span class="t-artist">${t.artist}</span>
      <label><input type="checkbox" class="pub-chk" ${t.published?"checked":""}> published</label>
      <button class="edit-btn">Edit</button>
      <button class="del-btn">Delete</button>
    `;
    row.querySelector(".pub-chk").onchange = (e) =>
      supabase.from("tracks").update({ published: e.target.checked }).eq("id", t.id);

    row.querySelector(".edit-btn").onclick = async () => {
      const title  = prompt("Title:",  t.title);  if (title  === null) return;
      const artist = prompt("Artist:", t.artist); if (artist === null) return;
      const { error } = await supabase.from("tracks").update({ title, artist }).eq("id", t.id);
      if (error) return alert(error.message);
      row.querySelector(".t-title").textContent  = title;
      row.querySelector(".t-artist").textContent = artist;
    };

    row.querySelector(".del-btn").onclick = async () => {
      if (!confirm(`Delete "${t.title}"?`)) return;
      await supabase.storage.from("music").remove([t.audio_path]);
      if (t.cover_path) await supabase.storage.from("covers").remove([t.cover_path]);
      const { error } = await supabase.from("tracks").delete().eq("id", t.id);
      if (error) return alert(error.message);
      row.remove();
    };

    wrap.appendChild(row);
  });
}

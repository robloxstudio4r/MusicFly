import { supabase } from "../supabase.js";
import { isAdmin } from "../auth.js";

export async function render() {
  const el = document.createElement("div");
  el.className = "page admin";

  if (!isAdmin()) {
    el.innerHTML = "<p>Access denied.</p>";
    return el;
  }

  el.innerHTML = `
    <h1>Admin Panel</h1>
    <section>
      <h2>Users</h2>
      <table id="users-table">
        <thead><tr><th>Email</th><th>Role</th><th>Premium</th><th>Banned</th><th>Actions</th></tr></thead>
        <tbody></tbody>
      </table>
    </section>
    <section>
      <h2>All Tracks</h2>
      <div id="all-tracks"></div>
    </section>
  `;

  await loadUsers(el);
  await loadTracks(el);
  return el;
}

async function loadUsers(el) {
  const { data } = await supabase.from("profiles").select("*");
  const tbody = el.querySelector("#users-table tbody");
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
      <td><button data-id="${u.id}" class="del-btn">Delete</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.addEventListener("change", async (e) => {
    const id = e.target.dataset.id;
    if (!id) return;
    if (e.target.classList.contains("role-sel"))
      await supabase.from("profiles").update({ role: e.target.value }).eq("id", id);
    if (e.target.classList.contains("prem-chk"))
      await supabase.from("profiles").update({ premium: e.target.checked }).eq("id", id);
    if (e.target.classList.contains("ban-chk"))
      await supabase.from("profiles").update({ banned: e.target.checked }).eq("id", id);
  });

  tbody.addEventListener("click", async (e) => {
    if (e.target.classList.contains("del-btn")) {
      await supabase.from("profiles").delete().eq("id", e.target.dataset.id);
      e.target.closest("tr").remove();
    }
  });
}

async function loadTracks(el) {
  const { data } = await supabase.from("tracks").select("*").order("created_at", {ascending:false});
  const wrap = el.querySelector("#all-tracks");
  (data ?? []).forEach(t => {
    const row = document.createElement("div");
    row.className = "admin-track";
    row.innerHTML = `
      <span>${t.title} — ${t.artist}</span>
      <label><input type="checkbox" ${t.published?"checked":""}> published</label>
      <button>Delete</button>
    `;
    row.querySelector("input").onchange = (e) =>
      supabase.from("tracks").update({ published: e.target.checked }).eq("id", t.id);
    row.querySelector("button").onclick = async () => {
      await supabase.storage.from("music").remove([t.audio_path]);
      await supabase.from("tracks").delete().eq("id", t.id);
      row.remove();
    };
    wrap.appendChild(row);
  });
}

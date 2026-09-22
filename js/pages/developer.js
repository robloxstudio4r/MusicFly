import { supabase } from "../supabase.js";
import { currentUser, isPremium } from "../auth.js";

export async function render() {
  const el = document.createElement("div");
  el.className = "page developer";
  if (!currentUser) { el.innerHTML = "<p>Sign in first.</p>"; return el; }
  if (!isPremium()) {
    el.innerHTML = "<p>Premium required. <a href='/premium' data-link>Upgrade</a>.</p>";
    return el;
  }

  el.innerHTML = `
    <header class="topbar"><h1>Developer Portal</h1><nav>
      <a href="/" data-link>Home</a>
    </nav></header>
    <button id="new-key">Generate API Key</button>
    <div id="keys"></div>
    <h2>Docs</h2>
    <pre>
GET https://&lt;project&gt;.functions.supabase.co/api/v1/tracks
Authorization: Bearer &lt;your-key&gt;

GET .../v1/tracks/search?q=beatles
    </pre>
  `;

  el.querySelector("#new-key").onclick = async () => {
    const name = prompt("Key name:", "My App");
    if (!name) return;
    const key = "mf_" + crypto.randomUUID().replace(/-/g,"");
    const { error } = await supabase.from("api_keys").insert({
      user_id: currentUser.id, key, name,
    });
    if (error) return alert(error.message);
    loadKeys(el);
  };

  await loadKeys(el);
  return el;
}

async function loadKeys(el) {
  const { data } = await supabase.from("api_keys")
    .select("*").eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  const wrap = el.querySelector("#keys");
  wrap.innerHTML = "";
  (data ?? []).forEach(k => {
    const row = document.createElement("div");
    row.className = "key-row";
    row.innerHTML = `
      <strong>${k.name ?? "Default"}</strong>
      <code>${k.revoked ? "(revoked)" : k.key}</code>
      <button class="revoke">Revoke</button>
      <button class="delete">Delete</button>
    `;
    row.querySelector(".revoke").onclick = async () => {
      await supabase.from("api_keys").update({ revoked: true }).eq("id", k.id);
      loadKeys(el);
    };
    row.querySelector(".delete").onclick = async () => {
      if (!confirm("Delete this key?")) return;
      await supabase.from("api_keys").delete().eq("id", k.id);
      loadKeys(el);
    };
    wrap.appendChild(row);
  });
}

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
    <h1>Developer Portal</h1>
    <button id="new-key">Generate API Key</button>
    <div id="keys"></div>
  `;

  el.querySelector("#new-key").onclick = async () => {
    const key = "mf_" + crypto.randomUUID().replace(/-/g,"");
    const { error } = await supabase.from("api_keys").insert({
      user_id: currentUser.id,
      key,
      name: "Default",
    });
    if (error) return alert(error.message);
    loadKeys(el);
  };

  loadKeys(el);
  return el;
}

async function loadKeys(el) {
  const { data } = await supabase.from("api_keys").select("*").eq("user_id", currentUser.id);
  const wrap = el.querySelector("#keys");
  wrap.innerHTML = "";
  (data ?? []).forEach(k => {
    const row = document.createElement("div");
    row.innerHTML = `<code>${k.key}</code>
      <button data-id="${k.id}">Revoke</button>`;
    row.querySelector("button").onclick = async () => {
      await supabase.from("api_keys").delete().eq("id", k.id);
      row.remove();
    };
    wrap.appendChild(row);
  });
}

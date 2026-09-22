import { supabase } from "../supabase.js";
import { playTrack } from "../player.js";

export async function render() {
  const el = document.createElement("div");
  el.className = "page search";
  el.innerHTML = `
    <header class="topbar"><h1>Search</h1><nav>
      <a href="/" data-link>Home</a><a href="/search" data-link>Search</a>
    </nav></header>
    <input id="q" placeholder="Search tracks, artists…" autofocus />
    <div id="results"></div>
  `;

  const input = el.querySelector("#q");
  let debounce;
  input.oninput = () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => run(el, input.value.trim()), 250);
  };

  // initial
  run(el, "");
  return el;
}

async function run(el, q) {
  const results = el.querySelector("#results");
  results.innerHTML = "<div class='loader'>…</div>";

  let query = supabase
    .from("tracks")
    .select("*, creator:profiles!tracks_creator_id_fkey(username, verified)")
    .eq("published", true)
    .limit(50);

  if (q) query = query.or(`title.ilike.%${q}%,artist.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) { results.innerHTML = `<pre>${error.message}</pre>`; return; }

  results.innerHTML = "";
  (data ?? []).forEach(t => {
    const card = document.createElement("button");
    card.className = "track-card";
    const badge = t.creator?.verified ? " ✅" : "";
    card.innerHTML = `<strong>${t.title}</strong><span>${t.artist}${badge}</span>`;
    card.onclick = () => playTrack(t, data);
    results.appendChild(card);
  });
}

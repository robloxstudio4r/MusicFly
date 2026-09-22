import { supabase } from "../supabase.js";
import { currentProfile } from "../auth.js";
import { playTrack } from "../player.js";

export async function render() {
  const el = document.createElement("div");
  el.className = "page home";

  const { data: tracks } = await supabase
    .from("tracks")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(30);

  el.innerHTML = `
    <header class="topbar">
      <h1>MusicFly</h1>
      <nav>
        <a href="/" data-link>Home</a>
        <a href="/search" data-link>Search</a>
        <a href="/library" data-link>Library</a>
        <a href="/premium" data-link>Premium</a>
        <a href="/developer" data-link>Developer</a>
        <a href="/creator" data-link>Creator Studio</a>
      </nav>
      <span>${currentProfile?.username ?? "Guest"}</span>
    </header>
    <section id="track-list" class="track-grid"></section>
  `;

  const list = el.querySelector("#track-list");
  (tracks ?? []).forEach(t => {
    const card = document.createElement("button");
    card.className = "track-card";
    card.innerHTML = `<strong>${t.title}</strong><span>${t.artist}</span>`;
    card.onclick = () => playTrack(t, tracks);
    list.appendChild(card);
  });

  return el;
}

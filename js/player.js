import { supabase } from "./supabase.js";

let audio = null;
let queue = [];
let index = 0;

export function initPlayer() {
  audio = new Audio();
  audio.addEventListener("ended", next);
  const root = document.getElementById("player-root");
  root.classList.add("player-bar");
  root.innerHTML = `
    <button id="p-prev">⏮</button>
    <button id="p-play">▶</button>
    <button id="p-next">⏭</button>
    <span id="p-title">Nothing playing</span>
    <input type="range" id="p-seek" min="0" max="100" value="0" />
  `;
  root.querySelector("#p-play").onclick = toggle;
  root.querySelector("#p-next").onclick = next;
  root.querySelector("#p-prev").onclick = prev;
  root.querySelector("#p-seek").oninput = (e) => {
    if (audio.duration) audio.currentTime = (e.target.value/100) * audio.duration;
  };
  audio.addEventListener("timeupdate", () => {
    if (!audio.duration) return;
    root.querySelector("#p-seek").value = (audio.currentTime/audio.duration)*100;
  });
}

export function playTrack(track, list = []) {
  queue = list.length ? list : [track];
  index = queue.findIndex(t => t.id === track.id);
  playCurrent();
}

async function playCurrent() {
  const track = queue[index];
  if (!track) return;

  // increment play count (won't fail if RLS blocks)
  supabase.rpc("increment_play", { track_id: track.id }).catch(()=>{});

  const { data: signed } = await supabase.storage
    .from("music")
    .createSignedUrl(track.audio_path, 3600);

  audio.src = signed?.signedUrl;
  await audio.play();

  document.getElementById("p-title").textContent = `${track.title} — ${track.artist}`;
  document.getElementById("p-play").textContent = "⏸";
}

function toggle() {
  if (!audio.src) return;
  if (audio.paused) { audio.play(); document.getElementById("p-play").textContent = "⏸"; }
  else { audio.pause(); document.getElementById("p-play").textContent = "▶"; }
}
function next() { if (index < queue.length - 1) { index++; playCurrent(); } }
function prev() { if (index > 0) { index--; playCurrent(); } }

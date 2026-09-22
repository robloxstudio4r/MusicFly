import { supabase } from "./supabase.js";

let audio = null;
let queue = [];
let index = 0;
let shuffle = false;
let repeat = "off"; // off | one | all
let currentTrack = null;

export function initPlayer() {
  audio = new Audio();
  audio.preload = "auto";
  audio.addEventListener("ended", onEnded);
  audio.addEventListener("timeupdate", updateProgress);
  audio.addEventListener("loadedmetadata", updateProgress);

  const root = document.getElementById("player-root");
  root.className = "player";
  root.innerHTML = `
    <div class="player-now">
      <div class="player-cover" id="p-cover"></div>
      <div class="player-meta">
        <div class="player-title" id="p-title">Nothing playing</div>
        <div class="player-artist" id="p-artist">—</div>
      </div>
      <button class="player-like" id="p-like" title="Like">♡</button>
    </div>

    <div class="player-center">
      <div class="player-controls">
        <button id="p-shuffle" title="Shuffle" class="ghost">⇄</button>
        <button id="p-prev"    title="Previous" class="ghost">⏮</button>
        <button id="p-play"    title="Play"     class="primary">▶</button>
        <button id="p-next"    title="Next"     class="ghost">⏭</button>
        <button id="p-repeat"  title="Repeat"   class="ghost">⟲</button>
      </div>
      <div class="player-seek">
        <span class="time" id="p-time-cur">0:00</span>
        <input type="range" id="p-seek" min="0" max="1000" value="0" />
        <span class="time" id="p-time-dur">0:00</span>
      </div>
    </div>

    <div class="player-right">
      <button id="p-vol-icon" class="ghost" title="Mute">🔊</button>
      <input type="range" id="p-vol" min="0" max="100" value="100" />
    </div>
  `;

  const $ = (id) => root.querySelector("#" + id);
  $("p-play").onclick    = toggle;
  $("p-next").onclick    = next;
  $("p-prev").onclick    = prev;
  $("p-shuffle").onclick = () => { shuffle = !shuffle; $("p-shuffle").classList.toggle("on", shuffle); };
  $("p-repeat").onclick  = () => {
    repeat = repeat === "off" ? "all" : repeat === "all" ? "one" : "off";
    $("p-repeat").classList.toggle("on", repeat !== "off");
    $("p-repeat").textContent = repeat === "one" ? "⟲¹" : "⟲";
  };
  $("p-seek").oninput = (e) => {
    if (audio.duration) audio.currentTime = (e.target.value / 1000) * audio.duration;
  };
  $("p-vol").oninput = (e) => {
    audio.volume = e.target.value / 100;
    $("p-vol-icon").textContent = audio.volume === 0 ? "🔇" : audio.volume < 0.5 ? "🔉" : "🔊";
  };
  $("p-vol-icon").onclick = () => {
    audio.muted = !audio.muted;
    $("p-vol-icon").textContent = audio.muted ? "🔇" : "🔊";
  };
  $("p-like").onclick = toggleLike;
}

export function playTrack(track, list = []) {
  queue = list.length ? [...list] : [track];
  index = queue.findIndex((t) => t.id === track.id);
  if (index < 0) index = 0;
  playCurrent();
}

async function playCurrent() {
  const track = queue[index];
  if (!track) return;
  currentTrack = track;

  supabase.rpc("increment_play", { track_id: track.id }).then(() => {}, () => {});

  const { data: signed, error } = await supabase.storage
    .from("music").createSignedUrl(track.audio_path, 3600);
  if (error) { console.error(error); return; }

  audio.src = signed.signedUrl;
  try { await audio.play(); } catch (e) { console.warn("Autoplay blocked:", e); }

  const root = document.getElementById("player-root");
  root.classList.add("playing");
  root.querySelector("#p-title").textContent = track.title;
  root.querySelector("#p-artist").textContent = track.artist;
  root.querySelector("#p-play").textContent = "⏸";

  if (track.cover_path) {
    const { data: pub } = supabase.storage.from("covers").getPublicUrl(track.cover_path);
    root.querySelector("#p-cover").style.backgroundImage = `url('${pub.publicUrl}')`;
  } else {
    root.querySelector("#p-cover").style.backgroundImage = "";
  }
}

function toggle() {
  if (!audio.src) return;
  if (audio.paused) { audio.play(); document.querySelector("#p-play").textContent = "⏸"; }
  else              { audio.pause(); document.querySelector("#p-play").textContent = "▶"; }
}
function next() {
  if (shuffle && queue.length > 1) {
    let n; do { n = Math.floor(Math.random() * queue.length); } while (n === index);
    index = n;
  } else if (index < queue.length - 1) {
    index++;
  } else if (repeat === "all") {
    index = 0;
  } else {
    return;
  }
  playCurrent();
}
function prev() {
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  if (index > 0) { index--; playCurrent(); }
}
function onEnded() {
  if (repeat === "one") { audio.currentTime = 0; audio.play(); return; }
  next();
}
function updateProgress() {
  const root = document.getElementById("player-root");
  const cur = root.querySelector("#p-time-cur");
  const dur = root.querySelector("#p-time-dur");
  const seek = root.querySelector("#p-seek");
  if (!audio.duration) { cur.textContent = "0:00"; dur.textContent = "0:00"; seek.value = 0; return; }
  cur.textContent = fmt(audio.currentTime);
  dur.textContent = fmt(audio.duration);
  seek.value = (audio.currentTime / audio.duration) * 1000;
}
function fmt(s) {
  s = Math.floor(s);
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
}
async function toggleLike() {
  if (!currentTrack) return;
  const { currentUser } = await import("./auth.js");
  if (!currentUser) return;
  const { data: existing } = await supabase
    .from("likes").select("user_id")
    .eq("user_id", currentUser.id).eq("track_id", currentTrack.id).maybeSingle();
  const btn = document.querySelector("#p-like");
  if (existing) {
    await supabase.from("likes").delete().eq("user_id", currentUser.id).eq("track_id", currentTrack.id);
    btn.textContent = "♡"; btn.classList.remove("on");
  } else {
    await supabase.from("likes").insert({ user_id: currentUser.id, track_id: currentTrack.id });
    btn.textContent = "♥"; btn.classList.add("on");
  }
}

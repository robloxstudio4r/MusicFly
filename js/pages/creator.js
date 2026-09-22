import { supabase } from "../supabase.js";
import { currentUser, isCreator } from "../auth.js";

export async function render() {
  const el = document.createElement("div");
  el.className = "page creator";

  if (!currentUser) {
    el.innerHTML = "<p>Please <a href='/login' data-link>sign in</a>.</p>";
    return el;
  }
  if (!isCreator()) {
    el.innerHTML = "<p>You don't have creator access.</p>";
    return el;
  }

  el.innerHTML = `
    <h1>Creator Studio</h1>
    <form id="upload-form">
      <input name="title" placeholder="Title" required />
      <input name="artist" placeholder="Artist" required />
      <input name="genre" placeholder="Genre" />
      <input type="file" name="audio" accept="audio/*" required />
      <input type="file" name="cover" accept="image/*" />
      <button type="submit">Upload</button>
    </form>
    <div id="status"></div>
  `;

  el.querySelector("#upload-form").onsubmit = async (e) => {
    e.preventDefault();
    const status = el.querySelector("#status");
    const fd = new FormData(e.target);
    const audioFile = fd.get("audio");
    const coverFile = fd.get("cover");

    status.textContent = "Uploading audio…";
    const audioPath = `${currentUser.id}/${Date.now()}-${audioFile.name}`;
    const { error: upErr } = await supabase.storage
      .from("music").upload(audioPath, audioFile);
    if (upErr) { status.textContent = upErr.message; return; }

    let coverPath = null;
    if (coverFile && coverFile.size) {
      coverPath = `${currentUser.id}/${Date.now()}-${coverFile.name}`;
      await supabase.storage.from("covers").upload(coverPath, coverFile);
    }

    status.textContent = "Saving track…";
    const { error: insErr } = await supabase.from("tracks").insert({
      creator_id: currentUser.id,
      title: fd.get("title"),
      artist: fd.get("artist"),
      genre: fd.get("genre"),
      audio_path: audioPath,
      cover_path: coverPath,
      published: false,
    });
    status.textContent = insErr ? insErr.message : "Uploaded ✓ (pending publish)";
  };

  return el;
}

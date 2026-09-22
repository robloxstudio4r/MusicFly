import { supabase } from "../supabase.js";
import { currentUser, currentProfile, isPremium } from "../auth.js";

export async function render() {
  const el = document.createElement("div");
  el.className = "page premium";

  const premium = isPremium();

  el.innerHTML = `
    <header class="topbar">
      <h1 class="brand">MusicFly</h1>
      <nav>
        <a href="/" data-link>Home</a>
        <a href="/search" data-link>Search</a>
        <a href="/library" data-link>Library</a>
      </nav>
    </header>

    <section class="premium-hero">
      <h2>MusicFly Premium</h2>
      <p>Support creators, remove ads, and unlock the Developer Portal.</p>
    </section>

    <div class="plan-grid">
      <div class="plan-card ${premium ? "current" : ""}">
        <h3>Free</h3>
        <div class="price">$0<span>/mo</span></div>
        <ul>
          <li>✅ Listen to all published tracks</li>
          <li>✅ Create playlists</li>
          <li>✅ Like tracks</li>
          <li>❌ Ads</li>
          <li>❌ Developer API</li>
        </ul>
        ${premium
          ? ""
          : `<button class="btn" disabled>Current plan</button>`}
      </div>

      <div class="plan-card featured ${premium ? "current" : ""}">
        <h3>Premium</h3>
        <div class="price">$4.99<span>/mo</span></div>
        <ul>
          <li>✅ No ads</li>
          <li>✅ Developer Portal + API keys</li>
          <li>✅ Early access to new features</li>
          <li>✅ Support MusicFly creators</li>
        </ul>
        ${
          premium
            ? `<button class="btn" disabled>You're Premium ✓</button>
               <button class="btn ghost" id="manage">Manage subscription</button>`
            : `<button class="btn" id="upgrade">Upgrade to Premium</button>`
        }
      </div>
    </div>

    <section class="dev-hint">
      <h3>Already Premium?</h3>
      <p>
        Head to the <a href="/developer" data-link>Developer Portal</a> to
        generate API keys for your apps.
      </p>
    </section>

    <div id="status" class="status"></div>
  `;

  const statusEl = el.querySelector("#status");
  const upgrade = el.querySelector("#upgrade");
  const manage = el.querySelector("#manage");

  if (upgrade) {
    upgrade.onclick = async () => {
      if (!currentUser) {
        statusEl.textContent = "Please sign in first.";
        statusEl.style.color = "#f55";
        return;
      }
      // Stripe not wired yet — for now, direct DB flip.
      // Replace this block with a redirect to your Stripe Checkout URL.
      statusEl.textContent = "Processing…";

      const { error } = await supabase
        .from("profiles")
        .update({ premium: true })
        .eq("id", currentUser.id);

      if (error) {
        statusEl.textContent = "Error: " + error.message;
        statusEl.style.color = "#f55";
        return;
      }

      statusEl.textContent = "You're now Premium ✓";
      statusEl.style.color = "#1db954";

      // refresh local profile and re-render
      const { refreshProfile } = await import("../auth.js");
      await refreshProfile();
      setTimeout(() => location.reload(), 800);
    };
  }

  if (manage) {
    manage.onclick = () => {
      alert("Subscription management opens once billing is wired up.");
    };
  }

  return el;
}

import { supabase } from "./supabase.js";
import {
  currentUser, currentProfile, isAdmin, isCreator, isPremium,
  signOut, onAuthChange,
} from "./auth.js";

export function initShell() {
  renderSidebar();
  onAuthChange(() => renderSidebar());
}

function renderSidebar() {
  const el = document.getElementById("sidebar");
  if (!el) return;

  const links = [
    { href: "/",         label: "Home",    icon: home() },
    { href: "/search",   label: "Search",  icon: search() },
    { href: "/library",  label: "Library", icon: library() },
  ];
  const extra = [];
  if (isCreator()) extra.push({ href: "/creator",   label: "Creator Studio",   icon: mic() });
  if (isPremium()) extra.push({ href: "/developer", label: "Developer Portal", icon: code() });
  if (isAdmin())   extra.push({ href: "/admin",     label: "Admin Panel",      icon: shield() });

  const path = location.pathname;

  el.innerHTML = `
    <div class="brand-row">
      <a href="/" data-link class="brand">
        <span class="brand-mark">♪</span>
        <span class="brand-text">MusicFly</span>
      </a>
    </div>

    <nav class="side-nav">
      ${links.map(l => `
        <a href="${l.href}" data-link class="side-link ${isActive(path, l.href) ? "active" : ""}">
          <span class="ico">${l.icon}</span>
          <span>${l.label}</span>
        </a>`).join("")}
    </nav>

    ${extra.length ? `
      <div class="side-divider"></div>
      <div class="side-label">Workspace</div>
      <nav class="side-nav">
        ${extra.map(l => `
          <a href="${l.href}" data-link class="side-link ${isActive(path, l.href) ? "active" : ""}">
            <span class="ico">${l.icon}</span>
            <span>${l.label}</span>
          </a>`).join("")}
      </nav>
    ` : ""}

    <div class="side-spacer"></div>

    <div class="side-footer">
      ${
        currentUser
          ? `
            <div class="side-user">
              <div class="avatar">${escapeHtml((currentProfile?.username || currentUser.email || "U")[0].toUpperCase())}</div>
              <div class="side-user-meta">
                <div class="side-user-name">${escapeHtml(currentProfile?.username || currentUser.email)}</div>
                <div class="side-user-role">
                  ${currentProfile?.verified ? "✅ " : ""}
                  ${isAdmin() ? "Admin" : isCreator() ? "Creator" : isPremium() ? "Premium" : "Free"}
                </div>
              </div>
            </div>
            <button class="side-logout" id="logout-btn">Log out</button>
          `
          : `<a href="/login" data-link class="btn primary full">Log in</a>`
      }
    </div>
  `;

  const logout = el.querySelector("#logout-btn");
  if (logout) {
    logout.onclick = async () => {
      await signOut();
      location.href = "./";
    };
  }
}

function isActive(current, href) {
  if (href === "/") return current === "/" || current.endsWith("/index.html") || current.endsWith("/repo/");
  return current.startsWith(href);
}

/* --- inline svg icons (no library needed) --- */
function home()    { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10l9-7 9 7v10a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2z"/></svg>`; }
function search()  { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>`; }
function library() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h4v16H4zM10 4h4v16h-4zM16 6l4 1-3 14-4-1z"/></svg>`; }
function mic()     { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>`; }
function code()    { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6l-6 6 6 6M16 6l6 6-6 6"/></svg>`; }
function shield()  { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></svg>`; }

function escapeHtml(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

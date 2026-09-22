// Base path for GitHub Pages — detects /repo/ prefix
export const BASE = (() => {
  // if hosted at user.github.io/repo/
  const parts = location.pathname.split("/").filter(Boolean);
  // If we're at the root of github pages user site, no base
  if (location.hostname.endsWith("github.io") && parts.length > 0) {
    // Don't treat "index.html" as a base
    if (parts[0].includes(".")) return "/";
    return "/" + parts[0];
  }
  return "";
})();

export function route(path) {
  // strip base, normalize
  if (BASE && path.startsWith(BASE)) path = path.slice(BASE.length);
  if (!path.startsWith("/")) path = "/" + path;
  return path || "/";
}

const routes = {
  "/":           () => import("./pages/home.js"),
  "/search":     () => import("./pages/search.js"),
  "/library":    () => import("./pages/library.js"),
  "/playlist":   () => import("./pages/playlist.js"),
  "/premium":    () => import("./pages/premium.js"),
  "/login":      () => import("./pages/login.js"),
  "/developer":  () => import("./pages/developer.js"),
  "/creator":    () => import("./pages/creator.js"),
  "/admin":      () => import("./pages/admin.js"),
  "/404":        () => import("./pages/home.js"),
};

export function navigate(path) {
  history.pushState({}, "", BASE + path);
  render();
}

async function render() {
  const path = route(location.pathname);
  const loader = routes[path] || routes["/404"];
  const app = document.getElementById("app");
  app.innerHTML = "<div class='loader'>Loading…</div>";
  try {
    const mod = await loader();
    app.innerHTML = "";
    app.appendChild(await mod.render());
  } catch (e) {
    console.error(e);
    app.innerHTML = `<pre class="error">${e.message}\n${e.stack}</pre>`;
  }
}

export function initRouter() {
  window.addEventListener("popstate", render);
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-link]");
    if (!a) return;
    e.preventDefault();
    navigate(a.getAttribute("href"));
  });
  render();
}

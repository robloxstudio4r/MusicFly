const routes = {
  "/":            () => import("./pages/home.js"),
  "/search":      () => import("./pages/search.js"),
  "/library":     () => import("./pages/library.js"),
  "/playlist":    () => import("./pages/playlist.js"),
  "/premium":     () => import("./pages/premium.js"),
  "/login":       () => import("./pages/login.js"),
  "/developer":   () => import("./pages/developer.js"),
  "/creator":     () => import("./pages/creator.js"),
  "/admin":       () => import("./pages/admin.js"),
};

export function navigate(path) {
  history.pushState({}, "", path);
  render();
}

async function render() {
  const path = location.pathname;
  const loader = routes[path] || routes["/"];
  const app = document.getElementById("app");
  app.innerHTML = "<div class='loader'>Loading…</div>";

  try {
    const mod = await loader();
    app.innerHTML = "";
    app.appendChild(await mod.render());
  } catch (e) {
    console.error(e);
    app.innerHTML = "<div class='error'>Failed to load page.</div>";
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

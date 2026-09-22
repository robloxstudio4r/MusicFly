import { initRouter } from "./router.js";
import { initAuth } from "./auth.js";
import { initPlayer } from "./player.js";

window.addEventListener("error", (e) => {
  const b = document.getElementById("boot-error");
  if (b) b.textContent = "Error: " + e.message;
});
window.addEventListener("unhandledrejection", (e) => {
  const b = document.getElementById("boot-error");
  if (b) b.textContent = "Async error: " + (e.reason?.message || e.reason);
});

(async () => {
  try {
    await initAuth();
    initPlayer();
    initRouter();
  } catch (e) {
    console.error(e);
    document.getElementById("boot-error").textContent =
      "Boot failed: " + e.message;
  }
})();

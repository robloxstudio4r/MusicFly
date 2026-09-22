import { initRouter } from "./router.js";
import { initAuth } from "./auth.js";
import { initPlayer } from "./player.js";
import { initShell } from "./shell.js";   // ← add

window.addEventListener("error", (e) => {
  const b = document.getElementById("boot-error");
  if (b) b.textContent = "Error: " + e.message;
});

(async () => {
  try {
    await initAuth();
    initShell();     // ← add (before router)
    initPlayer();
    initRouter();
  } catch (e) {
    console.error(e);
    document.getElementById("boot-error").textContent = "Boot failed: " + e.message;
  }
})();

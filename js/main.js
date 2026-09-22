import { initRouter } from "./router.js";
import { initAuth } from "./auth.js";
import { initPlayer } from "./player.js";

async function boot() {
  await initAuth();
  initPlayer();
  initRouter();
}

boot().catch(console.error);

import { signIn, signUp, currentUser } from "../auth.js";
import { navigate } from "../router.js";

export async function render() {
  const el = document.createElement("div");
  el.className = "page login";

  // already signed in → bounce home
  if (currentUser) {
    el.innerHTML = `
      <div class="empty-state">
        <p>You're signed in. <a href="/" data-link>Go home</a>.</p>
      </div>`;
    return el;
  }

  el.innerHTML = `
    <header class="topbar">
      <h1 class="brand">MusicFly</h1>
      <nav><a href="/" data-link>Home</a></nav>
    </header>

    <div class="auth-wrap">
      <div class="tabs">
        <button data-mode="login" class="active">Log in</button>
        <button data-mode="signup">Sign up</button>
      </div>

      <form id="auth-form" autocomplete="on">
        <label>
          Email
          <input type="email" name="email" required autocomplete="email" />
        </label>

        <label id="username-field" style="display:none">
          Username
          <input type="text" name="username" autocomplete="username" minlength="3" />
        </label>

        <label>
          Password
          <input type="password" name="password" required minlength="6"
                 autocomplete="current-password" />
        </label>

        <button type="submit" class="btn" id="submit-btn">Log in</button>
        <div id="status" class="status"></div>
      </form>

      <p class="muted">
        By using MusicFly you agree to our
        <a href="#" onclick="return false">Terms</a> and
        <a href="#" onclick="return false">Privacy Policy</a>.
      </p>
    </div>
  `;

  const tabs = el.querySelectorAll(".tabs button");
  const form = el.querySelector("#auth-form");
  const statusEl = el.querySelector("#status");
  const submitBtn = el.querySelector("#submit-btn");
  const usernameField = el.querySelector("#username-field");
  const passwordInput = form.querySelector('input[name="password"]');

  let mode = "login";

  tabs.forEach((t) => {
    t.onclick = () => {
      mode = t.dataset.mode;
      tabs.forEach((x) => x.classList.toggle("active", x === t));
      submitBtn.textContent = mode === "login" ? "Log in" : "Sign up";
      usernameField.style.display = mode === "signup" ? "" : "none";
      passwordInput.autocomplete =
        mode === "login" ? "current-password" : "new-password";
      statusEl.textContent = "";
    };
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    statusEl.textContent = "";
    submitBtn.disabled = true;

    const fd = new FormData(form);
    const email = (fd.get("email") || "").trim();
    const password = fd.get("password") || "";
    const username = (fd.get("username") || "").trim();

    try {
      if (mode === "login") {
        await signIn(email, password);
        statusEl.textContent = "Welcome back! Redirecting…";
        statusEl.style.color = "#1db954";
        setTimeout(() => navigate("/"), 500);
      } else {
        if (username && username.length < 3)
          throw new Error("Username must be at least 3 characters.");
        await signUp(email, password, username);
        statusEl.textContent =
          "Account created. Check your email to confirm, then log in.";
        statusEl.style.color = "#1db954";
      }
    } catch (err) {
      console.error(err);
      statusEl.textContent = err.message || "Something went wrong.";
      statusEl.style.color = "#f55";
    } finally {
      submitBtn.disabled = false;
    }
  };

  return el;
}

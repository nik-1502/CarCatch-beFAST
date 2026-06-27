const coarsePointer = window.matchMedia("(pointer: coarse)");
const mobileViewport = window.matchMedia("(max-width: 1024px)");
const isMobile = navigator.maxTouchPoints > 0 && (coarsePointer.matches || mobileViewport.matches);

if (isMobile) {
  document.documentElement.classList.add("mobile-device");

  const shell = document.querySelector(".game-shell");
  const canvas = document.getElementById("game");
  const joystick = document.querySelector(".joystick");
  const stick = document.querySelector(".joystick-stick");
  const authPanel = document.querySelector(".mobile-auth");
  let activePointer = null;

  function updateJoystick(clientX, clientY) {
    const bounds = joystick.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const maxDistance = bounds.width * 0.31;
    const rawX = clientX - centerX;
    const rawY = clientY - centerY;
    const distance = Math.hypot(rawX, rawY);
    const scale = distance > maxDistance ? maxDistance / distance : 1;
    const offsetX = rawX * scale;
    const offsetY = rawY * scale;
    stick.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    window.CarCatch?.setMobileInput(offsetX / maxDistance, offsetY / maxDistance);
  }

  function releaseJoystick() {
    activePointer = null;
    stick.style.transform = "translate(0, 0)";
    window.CarCatch?.setMobileInput(0, 0);
  }

  joystick.addEventListener("pointerdown", (event) => {
    activePointer = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    updateJoystick(event.clientX, event.clientY);
  });
  joystick.addEventListener("pointermove", (event) => {
    if (event.pointerId === activePointer) updateJoystick(event.clientX, event.clientY);
  });
  joystick.addEventListener("pointerup", releaseJoystick);
  joystick.addEventListener("pointercancel", releaseJoystick);

  function renderAuthPanel(user) {
    if (user) {
      authPanel.innerHTML = `
        <strong>${user.username}</strong>
        <p class="mobile-auth-status"></p>
        <button type="button" data-auth-action="logout">Sign Out</button>
        <button type="button" data-auth-action="back">Back</button>
      `;
      return;
    }
    authPanel.innerHTML = `
      <label>Account Name<input name="account" autocomplete="username" maxlength="32"></label>
      <label>Password<input name="password" type="password" autocomplete="current-password" maxlength="64"></label>
      <div class="mobile-auth-actions">
        <button type="button" data-auth-action="login">Sign In</button>
        <button type="button" data-auth-action="create">Create User</button>
      </div>
      <p class="mobile-auth-status"></p>
      <button type="button" class="mobile-auth-back" data-auth-action="back">Back</button>
    `;
  }

  authPanel.addEventListener("click", (event) => {
    const action = event.target.closest("[data-auth-action]")?.dataset.authAction;
    if (!action) return;
    if (action === "back") window.CarCatch?.goToMenu();
    else if (action === "logout") window.CarCatch?.logout();
    else {
      const account = authPanel.querySelector('[name="account"]')?.value || "";
      const password = authPanel.querySelector('[name="password"]')?.value || "";
      window.CarCatch?.setProfileCredentials(account, password);
      window.CarCatch?.submitProfile(action);
    }
  });

  let previousState = "";
  let previousUserKey = "";
  let lastBackdropUpdate = 0;
  function syncMobileLayout(timestamp) {
    const state = window.CarCatch?.getState() || "menu";
    const gameplay = state === "game" || state === "countdown";
    shell.classList.toggle("mobile-gameplay", gameplay);
    if (!gameplay) releaseJoystick();

    const user = window.CarCatch?.getCurrentUser() || null;
    const userKey = user?.key || "guest";
    const showAuth = state === "profile";
    authPanel.hidden = !showAuth;
    if (showAuth && (previousState !== state || previousUserKey !== userKey)) renderAuthPanel(user);
    const status = authPanel.querySelector(".mobile-auth-status");
    if (status) status.textContent = window.CarCatch?.getProfileStatus() || "";
    if (timestamp - lastBackdropUpdate > 750) {
      try {
        shell.style.setProperty("--mobile-backdrop", `url(${canvas.toDataURL("image/jpeg", 0.55)})`);
      } catch (_) {
        // The static gradient remains when canvas snapshots are unavailable.
      }
      lastBackdropUpdate = timestamp;
    }
    previousState = state;
    previousUserKey = userKey;
    requestAnimationFrame(syncMobileLayout);
  }
  requestAnimationFrame(syncMobileLayout);
}

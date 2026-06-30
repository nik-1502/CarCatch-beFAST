const coarsePointer = window.matchMedia("(pointer: coarse)");
const mobileViewport = window.matchMedia("(max-width: 1024px)");
const narrowMobilePreview = window.matchMedia("(max-width: 700px)");
const portraitMobilePreview = window.matchMedia("(max-width: 1024px) and (orientation: portrait)");
const detectMobile = () => (navigator.maxTouchPoints > 0 && (coarsePointer.matches || mobileViewport.matches))
  || narrowMobilePreview.matches
  || portraitMobilePreview.matches;
const isMobile = detectMobile();

for (const mediaQuery of [coarsePointer, mobileViewport, narrowMobilePreview, portraitMobilePreview]) {
  mediaQuery.addEventListener("change", () => {
    if (detectMobile() !== isMobile) window.location.reload();
  });
}

if (isMobile) {
  document.documentElement.classList.add("mobile-device");

  const shell = document.querySelector(".game-shell");
  const canvas = document.getElementById("game");
  const backdrop = document.createElement("canvas");
  backdrop.id = "mobile-background";
  backdrop.className = "mobile-background";
  backdrop.setAttribute("aria-hidden", "true");
  shell.prepend(backdrop);
  const joystick = document.querySelector(".joystick");
  const stick = document.querySelector(".joystick-stick");
  const authPanel = document.querySelector(".mobile-auth");
  let activePointer = null;
  let canvasLayoutMode = "";

  // Keep native two-finger zoom, while `touch-action: manipulation` removes
  // the browser's double-tap zoom gesture on mobile.
  let viewportResetFrame = 0;
  function restoreUnzoomedViewport() {
    if (!window.visualViewport || window.visualViewport.scale > 1.01) return;
    cancelAnimationFrame(viewportResetFrame);
    viewportResetFrame = requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      // Reading the bounds after the viewport settles forces layout-dependent
      // canvas coordinates to use the normal, unzoomed geometry immediately.
      shell.getBoundingClientRect();
    });
  }

  window.visualViewport?.addEventListener("resize", restoreUnzoomedViewport);
  window.visualViewport?.addEventListener("scroll", restoreUnzoomedViewport);
  window.addEventListener("orientationchange", () => {
    canvasLayoutMode = "";
    restoreUnzoomedViewport();
  });

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

  authPanel.addEventListener("input", (event) => {
    if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) return;
    const account = authPanel.querySelector('[name="account"]')?.value || "";
    const password = authPanel.querySelector('[name="password"]')?.value || "";
    window.CarCatch?.setProfileCredentials(account, password);
  });

  let previousState = "";
  let previousUserKey = "";
  function updatePageFill() {
    try {
      const context = canvas.getContext("2d", { willReadFrequently: true });
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let red = 0;
      let green = 0;
      let blue = 0;
      let samples = 0;
      const addPixel = (x, y) => {
        const offset = (y * canvas.width + x) * 4;
        if (pixels[offset + 3] < 20) return;
        red += pixels[offset];
        green += pixels[offset + 1];
        blue += pixels[offset + 2];
        samples += 1;
      };
      for (let x = 8; x < canvas.width - 8; x += 24) {
        addPixel(x, 8);
        addPixel(x, canvas.height - 9);
      }
      for (let y = 8; y < canvas.height - 8; y += 24) {
        addPixel(8, y);
        addPixel(canvas.width - 9, y);
      }
      if (!samples) return;
      const darken = 0.72;
      shell.style.setProperty(
        "--mobile-fill",
        `rgb(${Math.round(red / samples * darken)}, ${Math.round(green / samples * darken)}, ${Math.round(blue / samples * darken)})`,
      );
    } catch (_) {
      shell.style.setProperty("--mobile-fill", "#25272d");
    }
  }

  canvas.addEventListener("pointerup", () => {
    window.setTimeout(updatePageFill, 80);
  });

  function syncMobileLayout() {
    const state = window.CarCatch?.getState() || "menu";
    const gameplay = state === "game" || state === "countdown";
    shell.classList.toggle("mobile-gameplay", gameplay);
    const nextCanvasLayoutMode = gameplay ? "gameplay" : "portrait-ui";
    if (canvasLayoutMode !== nextCanvasLayoutMode) {
      const logicalCanvasHeight = gameplay
        ? 600
        : Math.max(600, Math.round(800 * shell.clientHeight / Math.max(1, shell.clientWidth)));
      const deviceScale = Math.min(window.devicePixelRatio || 1, 2.5);
      const renderScale = Math.max(1, Math.min(2, shell.clientWidth * deviceScale / 800));
      const desiredCanvasWidth = Math.round(800 * renderScale);
      const desiredCanvasHeight = Math.round(logicalCanvasHeight * renderScale);
      canvas.dataset.logicalHeight = String(logicalCanvasHeight);
      if (canvas.width !== desiredCanvasWidth || canvas.height !== desiredCanvasHeight) {
        canvas.width = desiredCanvasWidth;
        canvas.height = desiredCanvasHeight;
      }
      canvasLayoutMode = nextCanvasLayoutMode;
    }
    if (!gameplay) releaseJoystick();

    const user = window.CarCatch?.getCurrentUser() || null;
    const userKey = user?.key || "guest";
    const showAuth = state === "profile";
    authPanel.hidden = !showAuth;
    if (showAuth && (previousState !== state || previousUserKey !== userKey)) renderAuthPanel(user);
    const status = authPanel.querySelector(".mobile-auth-status");
    if (status) status.textContent = window.CarCatch?.getProfileStatus() || "";
    if (previousState !== state) requestAnimationFrame(() => requestAnimationFrame(updatePageFill));
    previousState = state;
    previousUserKey = userKey;
    requestAnimationFrame(syncMobileLayout);
  }
  requestAnimationFrame(syncMobileLayout);
}

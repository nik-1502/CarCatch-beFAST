const coarsePointer = window.matchMedia("(pointer: coarse)");
const mobileViewport = window.matchMedia("(max-width: 1024px)");
const narrowMobilePreview = window.matchMedia("(max-width: 700px)");
const portraitMobilePreview = window.matchMedia("(max-width: 1024px) and (orientation: portrait)");
const detectMobile = () => (navigator.maxTouchPoints > 0 && (coarsePointer.matches || mobileViewport.matches))
  || narrowMobilePreview.matches
  || portraitMobilePreview.matches;
const isMobile = detectMobile();

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
  const landscapeActions = document.querySelector(".mobile-landscape-actions");
  const gameplayBack = document.querySelector(".mobile-gameplay-back");
  let activePointer = null;
  let joystickBounds = null;
  let joystickFrame = 0;
  let pendingJoystickPoint = null;
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
    releaseJoystick();
    restoreUnzoomedViewport();
    window.CarCatch?.handleOrientationChange();
    window.setTimeout(() => {
      canvasLayoutMode = "";
      window.CarCatch?.handleOrientationChange();
      restoreUnzoomedViewport();
    }, 180);
  });

  function updateJoystick(clientX, clientY) {
    const bounds = joystickBounds || joystick.getBoundingClientRect();
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
    cancelAnimationFrame(joystickFrame);
    joystickFrame = 0;
    pendingJoystickPoint = null;
    activePointer = null;
    joystickBounds = null;
    stick.style.transform = "translate(0, 0)";
    window.CarCatch?.setMobileInput(0, 0);
  }

  function handleAuthAction(action) {
    if (action === "back") window.CarCatch?.goToMenu();
    else if (action === "logout") window.CarCatch?.logout();
    else if (action === "local-profile") {
      const account = authPanel.querySelector('[name="account"]')?.value || "";
      window.CarCatch?.useLocalProfile(account);
    }
    else {
      const account = authPanel.querySelector('[name="account"]')?.value || "";
      const password = authPanel.querySelector('[name="password"]')?.value || "";
      window.CarCatch?.setProfileCredentials(account, password);
      window.CarCatch?.submitProfile(action);
    }
  }

  function bindAuthActions() {
    for (const button of authPanel.querySelectorAll("[data-auth-action]")) {
      button.addEventListener("click", () => handleAuthAction(button.dataset.authAction));
    }
  }

  joystick.addEventListener("pointerdown", (event) => {
    if (activePointer !== null) return;
    activePointer = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    joystickBounds = joystick.getBoundingClientRect();
    updateJoystick(event.clientX, event.clientY);
  });
  joystick.addEventListener("pointermove", (event) => {
    if (event.pointerId !== activePointer) return;
    pendingJoystickPoint = { x: event.clientX, y: event.clientY };
    if (joystickFrame) return;
    joystickFrame = requestAnimationFrame(() => {
      joystickFrame = 0;
      if (!pendingJoystickPoint) return;
      updateJoystick(pendingJoystickPoint.x, pendingJoystickPoint.y);
      pendingJoystickPoint = null;
    });
  });
  joystick.addEventListener("pointerup", (event) => {
    if (event.pointerId === activePointer) releaseJoystick();
  });
  joystick.addEventListener("pointercancel", (event) => {
    if (event.pointerId === activePointer) releaseJoystick();
  });

  landscapeActions.addEventListener("click", (event) => {
    const action = event.target.closest("[data-mobile-action]")?.dataset.mobileAction;
    if (action === "profile") window.CarCatch?.openProfile();
    else if (action === "leaderboard") window.CarCatch?.openLeaderboard();
    else if (action === "back") window.CarCatch?.goBack();
  });
  gameplayBack.addEventListener("click", () => window.CarCatch?.leaveGameplay());

  function renderAuthPanel(user) {
    if (user) {
      authPanel.innerHTML = `
        <strong>${user.username}</strong>
        <p class="mobile-auth-status"></p>
        <button type="button" data-auth-action="logout">Sign Out</button>
      `;
      bindAuthActions();
      return;
    }
    authPanel.innerHTML = `
      <strong>Local Player Profile</strong>
      <label>Player Name<input name="account" autocomplete="nickname" maxlength="32"></label>
      <button type="button" data-auth-action="local-profile">Continue</button>
      <p class="mobile-auth-status"></p>
    `;
    bindAuthActions();
  }

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
    const mobileMenu = state === "menu";
    const mobileBack = !["menu", "game", "countdown", "scoreboard"].includes(state);
    landscapeActions.hidden = !(mobileMenu || mobileBack);
    landscapeActions.classList.toggle("show-menu-actions", mobileMenu);
    landscapeActions.classList.toggle("show-back-action", mobileBack);
    gameplayBack.hidden = !gameplay;
    shell.classList.toggle("mobile-gameplay", gameplay);
    const nextCanvasLayoutMode = gameplay ? "gameplay" : "portrait-ui";
    if (canvasLayoutMode !== nextCanvasLayoutMode) {
      const logicalCanvasHeight = gameplay
        ? 600
        : Math.max(600, Math.round(800 * shell.clientHeight / Math.max(1, shell.clientWidth)));
      const deviceScale = Math.min(window.devicePixelRatio || 1, 2);
      const maxRenderScale = gameplay ? 1.25 : 1.5;
      const renderScale = Math.max(1, Math.min(maxRenderScale, shell.clientWidth * deviceScale / 800));
      const desiredCanvasWidth = Math.round(800 * renderScale);
      const desiredCanvasHeight = Math.round(logicalCanvasHeight * renderScale);
      canvas.dataset.logicalHeight = String(logicalCanvasHeight);
      if (canvas.width !== desiredCanvasWidth || canvas.height !== desiredCanvasHeight) {
        canvas.width = desiredCanvasWidth;
        canvas.height = desiredCanvasHeight;
      }
      canvasLayoutMode = nextCanvasLayoutMode;
    }
    const canvasBounds = canvas.getBoundingClientRect();
    const logicalHeight = Number(canvas.dataset.logicalHeight) || 600;
    const scaleX = canvasBounds.width / 800;
    const scaleY = canvasBounds.height / logicalHeight;
    const navigationSize = Math.max(34, 76 * scaleY);
    landscapeActions.style.setProperty("--mobile-nav-size", `${navigationSize}px`);
    landscapeActions.style.setProperty("--mobile-nav-top", `${canvasBounds.top + 24 * scaleY}px`);
    landscapeActions.style.setProperty("--mobile-back-left", `${Math.min(
      window.innerWidth - navigationSize - 8,
      canvasBounds.left + 670 * scaleX + 24 * scaleX,
    )}px`);
    gameplayBack.style.setProperty("--mobile-nav-size", `${navigationSize}px`);
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

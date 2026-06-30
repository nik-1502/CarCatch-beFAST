"use strict";

import {
  getSupabaseSession,
  loadSupabaseHighscores,
  onSupabaseAuthChange,
  saveSupabaseHighscores,
  signInWithSupabase,
  signOutFromSupabase,
  signUpWithSupabase,
} from "./supabase.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const MOBILE_DEVICE = (navigator.maxTouchPoints > 0
  && (window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(max-width: 1024px)").matches))
  || window.matchMedia("(max-width: 700px)").matches
  || window.matchMedia("(max-width: 1024px) and (orientation: portrait)").matches;
const MOBILE_PORTRAIT_LAYOUT = MOBILE_DEVICE && window.matchMedia("(orientation: portrait)").matches;

const WIDTH = 800;
const HEIGHT = 600;
const FPS = 60;

const BEIGE = [232, 194, 150];
const OBSTACLE_MID = [190, 120, 70];
const WHITE = [255, 255, 255];
const KHAKI = [120, 140, 70];
const DARK_BROWN = [70, 40, 20];
const YELLOW = [255, 220, 90];
const RELAXED_RED = [180, 60, 60];
const RED = [230, 60, 60];
const CAR_WINDOW = [40, 40, 60];
const NEON_CYAN = [0, 255, 255];
const BARREL_WHITE = [220, 220, 220];

const CAR_COLORS = [
  [230, 60, 60], [135, 235, 60], [0, 85, 180], [255, 220, 0],
  [255, 140, 0], [140, 0, 200], [0, 255, 255], [255, 0, 255],
  [200, 200, 200], [50, 50, 50], [255, 105, 180], [128, 128, 0],
];

function rgb(c, a = 1) {
  return a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

function generateFullPalette(baseColors) {
  const palette = [];
  for (const f of [0.8, 0.6, 0.3]) {
    for (const col of baseColors) {
      palette.push(col.map((v) => Math.trunc(v + (255 - v) * f)));
    }
  }
  palette.push(...baseColors.map((c) => [...c]));
  for (const f of [0.8, 0.6, 0.4]) {
    for (const col of baseColors) palette.push(col.map((v) => Math.trunc(v * f)));
  }
  return palette;
}

const FULL_PALETTE = generateFullPalette(CAR_COLORS);

const THEMES = [
  { name: "Standard", bg: [82, 86, 92], structure: "standard" },
  { name: "Desert", bg: [232, 194, 150], structure: "desert" },
  { name: "Ice", bg: [220, 240, 255], structure: "ice" },
  { name: "Neon", bg: [0, 0, 0], lineColor: [200, 0, 200], structure: "neon" },
];
const DEFAULT_THEME_SETTINGS = THEMES.map((theme) => ({
  bg: [...theme.bg],
  lineColor: theme.lineColor ? [...theme.lineColor] : null,
}));

const offsetX = 180;
const offsetY = 140;
const radius = Math.trunc(15 * 2.5);

function v(x, y) { return { x, y }; }
function copy(p) { return { x: p.x, y: p.y }; }
function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
function mul(a, s) { return { x: a.x * s, y: a.y * s }; }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

const MAPS = [
  {
    name: "Classic Corners",
    pos: [v(offsetX, offsetY), v(WIDTH - offsetX, offsetY), v(offsetX, HEIGHT - offsetY), v(WIDTH - offsetX, HEIGHT - offsetY)],
    spawn: v(WIDTH / 2, HEIGHT / 2),
  },
  { name: "Slalom Drift", pos: [v(WIDTH / 2, 150), v(WIDTH / 2, 300), v(WIDTH / 2, 450)], spawn: v(150, HEIGHT / 2) },
  {
    name: "The Arena",
    pos: [0, Math.PI / 3, 2 * Math.PI / 3, Math.PI, 4 * Math.PI / 3, 5 * Math.PI / 3].map((a) => v(WIDTH / 2 + 160 * Math.cos(a), HEIGHT / 2 + 160 * Math.sin(a))),
    spawn: v(WIDTH / 2, HEIGHT / 2),
  },
  { name: "Gatekeeper", pos: [v(200, HEIGHT / 2), v(WIDTH - 200, HEIGHT / 2), v(WIDTH / 2, 120), v(WIDTH / 2, HEIGHT - 120)], spawn: v(WIDTH / 2, HEIGHT / 2) },
  { name: "Chaos Theory", pos: [v(WIDTH / 2, HEIGHT / 2), v(250, 200), v(WIDTH - 250, 200), v(250, HEIGHT - 200), v(WIDTH - 250, HEIGHT - 200)], spawn: v(100, 100) },
];

const CAR_MODELS = [
  { id: 3, name: "Muscle" },
  { id: 2, name: "Sport" },
  { id: 1, name: "Buggy" },
  { id: 4, name: "Van" },
  { id: 5, name: "Formula" },
];

let selectedMapIndex = 0;
let selectedThemeIndex = 0;
let obstacles = MAPS[selectedMapIndex].pos;
let obstacleShape = "circle";
let obstacleColor = FULL_PALETTE[64];
let score = 0;
let selectedTime = 30;
let gameStartTime = 0;
let scoreboardTime = 30;
let scoreboardLayout = MAPS[0].name;
let pendingScore = null;
let guestTopScores = null;
let selectedCar = 1;
let selectedCarIndex = 2;
let selectedColor = FULL_PALETTE[47];
let selectedBoostColor = FULL_PALETTE[83];
let carPos = v(WIDTH / 2, HEIGHT / 2);
let carAngle = 0;
let velocity = 0;
let state = "menu";
let currentBgCategory = "menu";
let collectiblePos = v(400, 300);
let lastFrame = performance.now();
let physicsAccumulator = 0;
let bgTick = 0;
let countdownStartTime = 0;
let currentUser = null;
let profileUsername = "";
let profilePassword = "";
let activeProfileField = "username";
let profileMessage = "";
let profileBusy = false;
let leaderboardTime = 30;
let mobileInput = { x: 0, y: 0 };
let ignoredStartObstacles = new Set();

const carLength = 40;
const collectibleRadius = 10;
const maxSpeed = 6.3;
const acceleration = 0.3;
const stopFriction = 0.35;
const turnSpeed = 3.5;
const driftFactor = 0.85;
const borderRect = { x: 10, y: 10, w: WIDTH - 20, h: HEIGHT - 20 };
const borderThickness = 12;
const borderRadius = 35;
const borderInnerInset = 9;
const obstacleOuterWidth = 12;
const obstacleInnerWidth = 6;
const obstacleInnerInset = 9;
const carCollisionRadius = carLength / 2;
const timeOptions = [10, 15, 20, 30, 40, 50, 60];
const flameParticles = [];
let teleportEffect = null;
const bgStates = new Map();
const buttons = {};
const USER_STORAGE_KEY = "carcatch-users";
const SESSION_STORAGE_KEY = "carcatch-session";
const SUPABASE_USER_CACHE_KEY = "carcatch-supabase-user";
const SUPABASE_SCORE_CACHE_PREFIX = "carcatch-supabase-scores:";
const GAME_SETTINGS_STORAGE_PREFIX = "carcatch-settings:";
const DEVICE_PROFILE_STORAGE_KEY = "carcatch-device-profiles";

try {
  localStorage.removeItem("carcatch-guest-top-scores");
  localStorage.removeItem("carcatch-settings:guest");
  localStorage.removeItem("carcatch-backgrounds");
} catch (_) {
  // Storage can be unavailable in privacy-restricted browser contexts.
}

const keys = new Set();

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function choice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function lighten(c, factor) {
  return c.map((v) => Math.min(255, Math.trunc(v * factor)));
}

function loadUserStore() {
  try {
    const saved = JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || "{}");
    return saved.version === 1 && saved.users ? saved : { version: 1, users: {} };
  } catch (_) {
    return { version: 1, users: {} };
  }
}

function saveUserStore(store) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(store));
}

function loadDeviceProfileStore() {
  try {
    const saved = JSON.parse(localStorage.getItem(DEVICE_PROFILE_STORAGE_KEY) || "{}");
    return saved.version === 1 && saved.profiles ? saved : { version: 1, activeId: null, profiles: {} };
  } catch (_) {
    return { version: 1, activeId: null, profiles: {} };
  }
}

function saveDeviceProfileStore(store) {
  localStorage.setItem(DEVICE_PROFILE_STORAGE_KEY, JSON.stringify(store));
}

function activateDeviceProfile(username) {
  const trimmedUsername = String(username || "").trim();
  const normalizedUsername = normalizeUsername(trimmedUsername);
  if (normalizedUsername.length < 3) {
    profileMessage = "Player name must contain at least 3 characters.";
    return;
  }
  const store = loadDeviceProfileStore();
  let profile = Object.values(store.profiles).find((entry) => entry.normalizedUsername === normalizedUsername);
  if (!profile) {
    const id = crypto.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    profile = { id, normalizedUsername, username: trimmedUsername, data: { highscores: {}, settings: {}, statistics: {} } };
    store.profiles[id] = profile;
  } else {
    profile.username = trimmedUsername;
  }
  store.activeId = profile.id;
  saveDeviceProfileStore(store);
  currentUser = { key: profile.id, username: profile.username, source: "device" };
  profileUsername = profile.username;
  profilePassword = "";
  profileMessage = "Local profile ready.";
  loadGameSettings();
}

function normalizeUsername(username) {
  return username.trim().toLocaleLowerCase();
}

function usernameToAuthEmail(username) {
  const bytes = new TextEncoder().encode(normalizeUsername(username));
  const encodedUsername = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  return `u-${encodedUsername}@users.carcatch.invalid`;
}

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

async function hashPassword(password, salt) {
  const passwordBytes = new TextEncoder().encode(password);
  const key = await crypto.subtle.importKey("raw", passwordBytes, "PBKDF2", false, ["deriveBits"]);
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" },
    key,
    256,
  );
  return bytesToBase64(new Uint8Array(hash));
}

function restoreUserSession() {
  try {
    const cachedSupabaseUser = JSON.parse(localStorage.getItem(SUPABASE_USER_CACHE_KEY) || "null");
    if (cachedSupabaseUser?.id) {
      currentUser = { key: cachedSupabaseUser.id, username: cachedSupabaseUser.username, email: cachedSupabaseUser.email, source: "supabase" };
      profileUsername = cachedSupabaseUser.username || "";
      return;
    }
  } catch (_) {
    localStorage.removeItem(SUPABASE_USER_CACHE_KEY);
  }
  const deviceStore = loadDeviceProfileStore();
  const deviceProfile = deviceStore.profiles[deviceStore.activeId];
  if (deviceProfile) {
    currentUser = { key: deviceProfile.id, username: deviceProfile.username, source: "device" };
    profileUsername = deviceProfile.username;
    return;
  }
  const userKey = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!userKey) return;
  const account = loadUserStore().users[userKey];
  if (account) currentUser = { key: userKey, username: account.username, source: "local" };
  else localStorage.removeItem(SESSION_STORAGE_KEY);
}

function getCurrentUserData() {
  if (!currentUser) return null;
  if (currentUser.source === "local") return loadUserStore().users[currentUser.key]?.data || null;
  if (currentUser.source === "device") return loadDeviceProfileStore().profiles[currentUser.key]?.data || null;
  return null;
}

function updateCurrentUserData(update) {
  if (!currentUser) return;
  if (currentUser.source === "device") {
    const store = loadDeviceProfileStore();
    const profile = store.profiles[currentUser.key];
    if (!profile) return;
    profile.data = { ...profile.data, ...update };
    saveDeviceProfileStore(store);
    return;
  }
  if (currentUser.source !== "local") return;
  const store = loadUserStore();
  const account = store.users[currentUser.key];
  if (!account) return;
  account.data = { ...account.data, ...update };
  saveUserStore(store);
}

async function submitLocalProfile(action) {
  if (profileBusy) return;
  const userKey = normalizeUsername(profileUsername);
  if (userKey.length < 3) {
    profileMessage = "Username must contain at least 3 characters.";
    return;
  }
  if (profilePassword.length < 6) {
    profileMessage = "Password must contain at least 6 characters.";
    return;
  }
  if (!crypto?.subtle) {
    profileMessage = "Secure password storage is unavailable in this browser.";
    return;
  }

  profileBusy = true;
  profileMessage = "Please wait...";
  try {
    const store = loadUserStore();
    if (action === "create") {
      if (store.users[userKey]) {
        profileMessage = "This account already exists. Please sign in instead.";
        return;
      }
      const salt = crypto.getRandomValues(new Uint8Array(16));
      store.users[userKey] = {
        username: profileUsername.trim(),
        passwordHash: await hashPassword(profilePassword, salt),
        salt: bytesToBase64(salt),
        data: { highscores: {}, settings: {}, statistics: {} },
      };
      saveUserStore(store);
    } else {
      const account = store.users[userKey];
      if (!account) {
        profileMessage = "Username or password is incorrect.";
        return;
      }
      const salt = Uint8Array.from(atob(account.salt), (character) => character.charCodeAt(0));
      if (await hashPassword(profilePassword, salt) !== account.passwordHash) {
        profileMessage = "Username or password is incorrect.";
        return;
      }
    }

    const account = loadUserStore().users[userKey];
    currentUser = { key: userKey, username: account.username, source: "local" };
    loadGameSettings();
    localStorage.setItem(SESSION_STORAGE_KEY, userKey);
    profilePassword = "";
    profileMessage = action === "create" ? "Account created and signed in." : "Signed in successfully.";
  } catch (_) {
    profileMessage = "The account could not be saved.";
  } finally {
    profileBusy = false;
  }
}

function isNetworkFailure(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("fetch") || message.includes("network") || message.includes("import") || message.includes("load");
}

function cacheSupabaseUser(user) {
  const userChanged = currentUser?.source !== "supabase" || currentUser.key !== user.id;
  const cachedUser = {
    id: user.id,
    email: user.email || "",
    username: user.user_metadata?.username || user.email?.split("@")[0] || "Player",
  };
  localStorage.setItem(SUPABASE_USER_CACHE_KEY, JSON.stringify(cachedUser));
  currentUser = { key: cachedUser.id, username: cachedUser.username, email: cachedUser.email, source: "supabase" };
  profileUsername = cachedUser.username;
  if (userChanged) loadGameSettings();
}

async function submitProfile(action) {
  if (profileBusy) return;
  const username = profileUsername.trim();
  if (normalizeUsername(username).length < 3) {
    profileMessage = "Account name must contain at least 3 characters.";
    return;
  }
  if (profilePassword.length < 6) {
    profileMessage = "Password must contain at least 6 characters.";
    return;
  }

  profileBusy = true;
  profileMessage = "Connecting to Supabase...";
  try {
    const email = usernameToAuthEmail(username);
    const data = action === "create"
      ? await signUpWithSupabase(email, profilePassword, username)
      : await signInWithSupabase(email, profilePassword);
    if (action === "create" && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      profileMessage = "This account already exists. Please sign in instead.";
      return;
    }
    if (!data.session) {
      profilePassword = "";
      profileMessage = "Disable email confirmation in Supabase Auth settings.";
      return;
    }
    cacheSupabaseUser(data.user);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    profilePassword = "";
    profileMessage = action === "create" ? "Account created and signed in." : "Signed in successfully.";
    void syncHighscoresWithSupabase();
  } catch (error) {
    if (!isNetworkFailure(error)) {
      profileMessage = error?.message || "Supabase authentication failed.";
      return;
    }
    profileBusy = false;
    profileMessage = "Supabase offline - using local account storage.";
    await submitLocalProfile(action);
    return;
  } finally {
    profileBusy = false;
  }
}

function logoutUser() {
  if (currentUser?.source === "supabase") void signOutFromSupabase().catch(() => {});
  currentUser = null;
  profilePassword = "";
  profileMessage = "Signed out.";
  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(SUPABASE_USER_CACHE_KEY);
  const deviceStore = loadDeviceProfileStore();
  if (deviceStore.activeId) {
    deviceStore.activeId = null;
    saveDeviceProfileStore(deviceStore);
  }
  loadGameSettings();
}

function normalizeTopScores(scores) {
  const normalized = {};
  for (const duration of timeOptions) {
    normalized[duration] = {};
    for (const map of MAPS) {
      const values = Array.isArray(scores?.[duration]?.[map.name]) ? scores[duration][map.name] : [];
      normalized[duration][map.name] = values.filter(Number.isFinite).sort((a, b) => b - a).slice(0, 3);
    }
  }
  return normalized;
}

function getSupabaseScoreCacheKey(userId) {
  return `${SUPABASE_SCORE_CACHE_PREFIX}${userId}`;
}

function readSupabaseScoreCache(userId) {
  try {
    return normalizeTopScores(JSON.parse(localStorage.getItem(getSupabaseScoreCacheKey(userId)) || "{}"));
  } catch (_) {
    return normalizeTopScores({});
  }
}

function writeSupabaseScoreCache(userId, scores) {
  localStorage.setItem(getSupabaseScoreCacheKey(userId), JSON.stringify(normalizeTopScores(scores)));
}

function rowsToTopScores(rows) {
  const scores = normalizeTopScores({});
  for (const row of rows) {
    if (scores[row.duration]?.[row.layout] && Array.isArray(row.scores)) {
      scores[row.duration][row.layout] = row.scores;
    }
  }
  return normalizeTopScores(scores);
}

function mergeTopScores(first, second) {
  const merged = normalizeTopScores({});
  for (const duration of timeOptions) {
    for (const map of MAPS) {
      const firstCounts = new Map();
      const secondCounts = new Map();
      for (const scoreValue of first[duration][map.name]) firstCounts.set(scoreValue, (firstCounts.get(scoreValue) || 0) + 1);
      for (const scoreValue of second[duration][map.name]) secondCounts.set(scoreValue, (secondCounts.get(scoreValue) || 0) + 1);
      const values = [];
      for (const scoreValue of new Set([...firstCounts.keys(), ...secondCounts.keys()])) {
        const count = Math.max(firstCounts.get(scoreValue) || 0, secondCounts.get(scoreValue) || 0);
        for (let index = 0; index < count; index += 1) values.push(scoreValue);
      }
      merged[duration][map.name] = values.sort((a, b) => b - a).slice(0, 3);
    }
  }
  return merged;
}

async function syncHighscoresWithSupabase() {
  if (!currentUser || currentUser.source !== "supabase") return;
  const userId = currentUser.key;
  try {
    const localScores = readSupabaseScoreCache(userId);
    const remoteScores = rowsToTopScores(await loadSupabaseHighscores(userId));
    const mergedScores = mergeTopScores(localScores, remoteScores);
    writeSupabaseScoreCache(userId, mergedScores);
    await saveSupabaseHighscores(userId, mergedScores);
  } catch (_) {
    // Local scores remain authoritative until Supabase is reachable again.
  }
}

async function initializeSupabaseIntegration() {
  try {
    const session = await getSupabaseSession();
    if (session?.user) {
      cacheSupabaseUser(session.user);
      await syncHighscoresWithSupabase();
    }
    await onSupabaseAuthChange((event, nextSession) => {
      if (nextSession?.user) {
        cacheSupabaseUser(nextSession.user);
        void syncHighscoresWithSupabase();
      } else if (event === "SIGNED_OUT" && currentUser?.source === "supabase") {
        currentUser = null;
        localStorage.removeItem(SUPABASE_USER_CACHE_KEY);
      }
    });
  } catch (_) {
    // The cached/local account and all game features continue to work offline.
  }
}

function loadTopScores() {
  if (currentUser?.source === "supabase") return readSupabaseScoreCache(currentUser.key);
  if (currentUser?.source === "local" || currentUser?.source === "device") return normalizeTopScores(getCurrentUserData()?.highscores);
  if (!guestTopScores) guestTopScores = normalizeTopScores({});
  return normalizeTopScores(guestTopScores);
}

function saveTopScores(scores) {
  const normalized = normalizeTopScores(scores);
  if (currentUser?.source === "supabase") {
    writeSupabaseScoreCache(currentUser.key, normalized);
    void saveSupabaseHighscores(currentUser.key, normalized).catch(() => {});
  } else if (currentUser?.source === "local" || currentUser?.source === "device") {
    updateCurrentUserData({ highscores: normalized });
  } else {
    guestTopScores = normalized;
  }
}

function getScoreRank(newScore, topScores) {
  const betterIndex = topScores.findIndex((savedScore) => newScore > savedScore);
  if (betterIndex >= 0) return betterIndex;
  if (topScores.length < 3) return topScores.length;
  return null;
}

function commitPendingScore() {
  if (!pendingScore || pendingScore.committed || pendingScore.rank === null) return;
  const scores = loadTopScores();
  scores[pendingScore.time][pendingScore.layout].splice(pendingScore.rank, 0, pendingScore.score);
  scores[pendingScore.time][pendingScore.layout] = scores[pendingScore.time][pendingScore.layout].slice(0, 3);
  saveTopScores(scores);
  pendingScore.committed = true;
}

function finishRound() {
  scoreboardTime = selectedTime;
  scoreboardLayout = MAPS[selectedMapIndex].name;
  const topScores = loadTopScores()[scoreboardTime][scoreboardLayout];
  pendingScore = {
    score,
    time: scoreboardTime,
    layout: scoreboardLayout,
    rank: getScoreRank(score, topScores),
    endedAt: performance.now(),
    committed: false,
  };
  state = "scoreboard";
}

restoreUserSession();
void initializeSupabaseIntegration();

function darken(c, factor) {
  return c.map((v) => Math.max(0, Math.trunc(v * factor)));
}

function getBgState(key) {
  if (!bgStates.has(key)) bgStates.set(key, []);
  return bgStates.get(key);
}

function setFill(c, alpha = 1) { ctx.fillStyle = rgb(c, alpha); }
function setStroke(c, alpha = 1) { ctx.strokeStyle = rgb(c, alpha); }

function rect(x, y, w, h) {
  return { x, y, w, h };
}

function centeredRect(cx, cy, w, h) {
  return rect(cx - w / 2, cy - h / 2, w, h);
}

function hit(r, x, y) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function roundedRect(r, fill, stroke = null, lineWidth = 1, rad = 8) {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, rad);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function circle(p, r, fill, stroke = null, lineWidth = 1) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, Math.max(0, r), 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function poly(points, fill, stroke = null, lineWidth = 1) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function line(a, b, color, width = 1) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = rgb(color);
  ctx.lineWidth = width;
  ctx.stroke();
}

const DEFAULT_FONT_FAMILY = `"Arial Rounded MT Bold", "Trebuchet MS", Arial, sans-serif`;
// Keep the desktop face first, but avoid the generic `cursive` fallback: on
// mobile browsers that fallback often resolves to an unrelated script font.
const TITLE_FONT_FAMILY = `"Comic Sans MS", "Comic Sans", "Arial Rounded MT Bold", "Trebuchet MS", Arial, sans-serif`;

function text(value, x, y, size, color = WHITE, align = "center", baseline = "middle", fontFamily = DEFAULT_FONT_FAMILY) {
  ctx.font = `700 ${size}px ${fontFamily}`;
  ctx.fillStyle = rgb(color);
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(value, x, y);
}

function fitText(value, r, maxSize, color = WHITE, padX = 10, padY = 6, offsetY = 0, fontFamily = DEFAULT_FONT_FAMILY) {
  let size = maxSize;
  do {
    ctx.font = `700 ${size}px ${fontFamily}`;
    if (ctx.measureText(value).width <= r.w - padX * 2 && size <= r.h - padY * 2) break;
    size -= 1;
  } while (size > 10);
  text(value, r.x + r.w / 2, r.y + r.h / 2 + offsetY, size, color, "center", "middle", fontFamily);
}

function spawnCollectible() {
  while (true) {
    const pos = v(randInt(80, WIDTH - 80), randInt(80, HEIGHT - 80));
    const behindMobileScore = MOBILE_DEVICE
      && Math.abs(pos.x - WIDTH / 2) < 120
      && Math.abs(pos.y - HEIGHT / 2) < 90;
    if (!behindMobileScore && obstacles.every((o) => dist(pos, o) >= radius + 40)) return pos;
  }
}

function drawGridPerspective(color, speed = 1) {
  const t = bgTick * 0.002 * speed;
  line(v(0, HEIGHT / 3), v(WIDTH, HEIGHT / 3), color, 2);
  for (let i = -10; i < 20; i += 1) {
    const x = ((i * 100 + t * 50) % (WIDTH * 2)) - WIDTH * 0.5;
    const topX = WIDTH / 2 + (x - WIDTH / 2) * 0.2;
    line(v(topX, HEIGHT / 3), v(x, HEIGHT), color, 1);
  }
  for (let i = 0; i < 10; i += 1) {
    const yOff = (t * 20 + i * 40) % 400;
    const y = HEIGHT / 3 + yOff * (yOff / 400);
    if (y < HEIGHT) line(v(0, y), v(WIDTH, y), color, 1);
  }
}

function bgMenuParticles() {
  ctx.fillStyle = "rgb(20,20,25)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const parts = getBgState("menu_particles");
  if (!parts.length) {
    for (let i = 0; i < 80; i += 1) {
      parts.push({ p: v(randInt(0, WIDTH), randInt(0, HEIGHT)), vel: v(Math.random() - 0.5, Math.random() - 0.5), r: randInt(2, 4), c: choice([[50, 50, 80], [80, 50, 50], [50, 80, 50]]) });
    }
  }
  for (const p of parts) {
    p.p.x += p.vel.x;
    p.p.y += p.vel.y;
    if (p.p.x < 0) p.p.x = WIDTH;
    if (p.p.x > WIDTH) p.p.x = 0;
    if (p.p.y < 0) p.p.y = HEIGHT;
    if (p.p.y > HEIGHT) p.p.y = 0;
    circle(p.p, p.r, rgb(p.c));
  }
}

function bgMenuNeon() {
  ctx.fillStyle = "rgb(10,0,20)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  drawGridPerspective([200, 0, 200]);
  circle(v(WIDTH / 2, HEIGHT / 3 - 50), 60, "rgb(255,100,0)");
  ctx.fillStyle = "rgb(10,0,20)";
  ctx.fillRect(0, HEIGHT / 3, WIDTH, HEIGHT);
}

function bgMenuTraffic() {
  ctx.fillStyle = "rgb(30,30,30)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const cars = getBgState("menu_traffic");
  if (!cars.length) {
    for (let i = 0; i < 5; i += 1) cars.push({ x: randInt(0, WIDTH), y: randInt(100, 500), speed: 2 + Math.random() * 3, c: [randInt(100, 255), randInt(100, 255), randInt(100, 255)] });
  }
  for (const car of cars) {
    car.x += car.speed;
    if (car.x > WIDTH + 50) {
      car.x = -50;
      car.y = randInt(100, 500);
      car.c = [randInt(100, 255), randInt(100, 255), randInt(100, 255)];
    }
    roundedRect(rect(car.x, car.y, 40, 20), rgb(car.c), null, 1, 4);
    ctx.fillStyle = "rgb(255,255,200)";
    ctx.fillRect(car.x + 40, car.y + 2, 10, 5);
    ctx.fillRect(car.x + 40, car.y + 13, 10, 5);
    ctx.fillStyle = "rgb(255,0,0)";
    ctx.fillRect(car.x - 2, car.y + 2, 2, 5);
    ctx.fillRect(car.x - 2, car.y + 13, 2, 5);
  }
}

function bgMenuStars() {
  ctx.fillStyle = "rgb(5,5,10)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const stars = getBgState("menu_stars");
  if (!stars.length) for (let i = 0; i < 100; i += 1) stars.push({ x: randInt(0, WIDTH), y: randInt(0, HEIGHT), s: 0.5 + Math.random() * 1.5 });
  for (const s of stars) {
    s.x -= s.s;
    if (s.x < 0) s.x = WIDTH;
    const col = Math.trunc(150 + s.s * 50);
    circle(v(s.x, s.y), 1, `rgb(${col},${col},${col})`);
  }
}

function bgMenuRain() {
  ctx.fillStyle = "rgb(10,15,20)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const drops = getBgState("menu_rain");
  if (!drops.length) for (let i = 0; i < 100; i += 1) drops.push({ x: randInt(0, WIDTH), y: randInt(0, HEIGHT), s: randInt(5, 15) });
  for (const d of drops) {
    d.y += d.s;
    if (d.y > HEIGHT) {
      d.y = -10;
      d.x = randInt(0, WIDTH);
    }
    line(v(d.x, d.y), v(d.x, d.y + 10), [100, 120, 150], 1);
  }
}

function bgGarageBlueprint() {
  ctx.fillStyle = "rgb(0,50,100)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (let x = 0; x < WIDTH; x += 50) line(v(x, 0), v(x, HEIGHT), WHITE, 1);
  for (let y = 0; y < HEIGHT; y += 50) line(v(0, y), v(WIDTH, y), WHITE, 1);
  circle(v(WIDTH / 2, HEIGHT / 2), 150, null, rgb(WHITE), 2);
  line(v(WIDTH / 2 - 160, HEIGHT / 2), v(WIDTH / 2 + 160, HEIGHT / 2), WHITE, 1);
  line(v(WIDTH / 2, HEIGHT / 2 - 160), v(WIDTH / 2, HEIGHT / 2 + 160), WHITE, 1);
}

function bgGarageSpotlight() {
  ctx.fillStyle = "rgb(20,20,20)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const t = bgTick * 0.001;
  const x1 = WIDTH / 2 + Math.sin(t) * 200;
  const x2 = WIDTH / 2 + Math.sin(t + 2) * 200;
  poly([v(x1, 0), v(WIDTH / 2 - 100, HEIGHT), v(WIDTH / 2 + 100, HEIGHT)], "rgba(255,255,200,0.12)");
  poly([v(x2, 0), v(WIDTH / 2 - 100, HEIGHT), v(WIDTH / 2 + 100, HEIGHT)], "rgba(200,200,255,0.12)");
}

function bgGarageHex() {
  ctx.fillStyle = "rgb(30,30,35)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const t = bgTick * 0.002;
  for (let y = 0; y < HEIGHT + 40; y += 60) {
    for (let x = 0; x < WIDTH + 40; x += 60) {
      const off = Math.floor(y / 60) % 2 === 0 ? 30 : 0;
      const col = 40 + Math.trunc(Math.sin(x * 0.01 + y * 0.01 + t) * 20);
      circle(v(x + off, y), 25, null, `rgb(${col},${col},${col + 10})`, 2);
    }
  }
}

function bgGarageSmoke() {
  ctx.fillStyle = "rgb(10,10,10)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const parts = getBgState("garage_smoke");
  if (!parts.length) for (let i = 0; i < 50; i += 1) parts.push({ x: randInt(0, WIDTH), y: randInt(HEIGHT - 100, HEIGHT), r: randInt(20, 50), s: 0.5 + Math.random() * 1.5 });
  for (const p of parts) {
    p.y -= p.s;
    p.r += 0.1;
    if (p.y < -50) {
      p.y = HEIGHT + 50;
      p.x = randInt(0, WIDTH);
      p.r = randInt(20, 50);
    }
    circle(v(p.x, p.y), p.r, "rgba(50,50,50,0.05)");
  }
}

function bgGarageScan() {
  ctx.fillStyle = "rgb(0,20,0)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (let x = 0; x < WIDTH; x += 40) line(v(x, 0), v(x, HEIGHT), [0, 50, 0], 1);
  const y = (bgTick * 0.2) % HEIGHT;
  line(v(0, y), v(WIDTH, y), [0, 255, 0], 2);
  ctx.fillStyle = "rgba(0,255,0,0.2)";
  ctx.fillRect(0, y - 20, WIDTH, 40);
}

function bgMapRadar() {
  ctx.fillStyle = "rgb(0,20,10)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const c = v(WIDTH / 2, HEIGHT / 2);
  circle(c, 200, null, "rgb(0,80,40)", 2);
  circle(c, 100, null, "rgb(0,80,40)", 1);
  line(v(c.x - 200, c.y), v(c.x + 200, c.y), [0, 80, 40], 1);
  line(v(c.x, c.y - 200), v(c.x, c.y + 200), [0, 80, 40], 1);
  const a = ((bgTick * 0.1) % 360) * Math.PI / 180;
  line(c, v(c.x + Math.cos(a) * 200, c.y + Math.sin(a) * 200), [0, 255, 0], 2);
}

function bgMapDigital() {
  ctx.fillStyle = "rgb(10,10,15)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const bits = getBgState("map_bits");
  if (!bits.length) for (let i = 0; i < 100; i += 1) bits.push({ x: randInt(0, WIDTH / 20) * 20, y: randInt(0, HEIGHT / 20) * 20, b: randInt(0, 1) });
  if (Math.random() < 0.1) bits[randInt(0, 99)] = { x: randInt(0, WIDTH / 20) * 20, y: randInt(0, HEIGHT / 20) * 20, b: randInt(0, 1) };
  for (const b of bits) text(String(b.b), b.x, b.y, 24, b.b ? [0, 100, 0] : [0, 50, 0], "left", "top");
}

function bgMapTopo() {
  ctx.fillStyle = "rgb(30,30,30)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const t = bgTick * 0.001;
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    for (let x = 0; x < WIDTH + 20; x += 20) {
      const y = HEIGHT / 2 + Math.sin(x * 0.01 + t + i) * 50 + (i - 2) * 60;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgb(100,100,100)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function bgMapGridwave() {
  ctx.fillStyle = "rgb(20,0,20)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const t = bgTick * 0.002;
  for (let y = 0; y < HEIGHT; y += 40) {
    for (let x = 0; x < WIDTH; x += 40) {
      circle(v(x + Math.sin(y * 0.01 + t) * 10, y + Math.cos(x * 0.01 + t) * 10), 2, "rgb(50,0,50)");
    }
  }
}

function bgMapStatic() {
  ctx.fillStyle = "rgb(40,40,40)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (let i = 0; i < 500; i += 1) {
    const c = randInt(40, 60);
    ctx.fillStyle = `rgb(${c},${c},${c})`;
    ctx.fillRect(randInt(0, WIDTH), randInt(0, HEIGHT), 1, 1);
  }
}

function bgScoreConfetti() {
  ctx.fillStyle = "rgb(20,20,25)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const conf = getBgState("score_conf");
  if (!conf.length) for (let i = 0; i < 100; i += 1) conf.push({ x: randInt(0, WIDTH), y: randInt(-HEIGHT, 0), c: choice([RED, YELLOW, NEON_CYAN, [0, 255, 0]]), s: randInt(2, 5) });
  for (const c of conf) {
    c.y += c.s;
    if (c.y > HEIGHT) {
      c.y = -10;
      c.x = randInt(0, WIDTH);
    }
    ctx.fillStyle = rgb(c.c);
    ctx.fillRect(c.x, c.y, 5, 5);
  }
}

function bgScoreFireworks() {
  ctx.fillStyle = "rgb(10,10,20)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const fw = getBgState("score_fw");
  if (Math.random() < 0.05) fw.push({ x: randInt(100, WIDTH - 100), y: randInt(100, HEIGHT - 100), r: 0, c: choice([RED, YELLOW, NEON_CYAN]), max: randInt(50, 150) });
  for (let i = fw.length - 1; i >= 0; i -= 1) {
    const f = fw[i];
    f.r += 2;
    circle(v(f.x, f.y), f.r, null, rgb(f.c), 2);
    if (f.r >= f.max) fw.splice(i, 1);
  }
}

function bgScoreGold() {
  ctx.fillStyle = "rgb(50,40,0)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const parts = getBgState("score_gold");
  if (!parts.length) for (let i = 0; i < 50; i += 1) parts.push({ x: randInt(0, WIDTH), y: randInt(0, HEIGHT), r: randInt(1, 3) });
  for (const p of parts) {
    p.y -= 1;
    if (p.y < 0) {
      p.y = HEIGHT;
      p.x = randInt(0, WIDTH);
    }
    const col = randInt(150, 255);
    circle(v(p.x, p.y), p.r, `rgb(${col},${col},0)`);
  }
}

function bgScoreMatrix() {
  ctx.fillStyle = "rgb(0,0,0)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const drops = getBgState("score_matrix");
  if (!drops.length) for (let x = 0; x < WIDTH; x += 20) drops.push({ x, y: randInt(-HEIGHT, 0) });
  for (const d of drops) {
    d.y += 5;
    if (d.y > HEIGHT) d.y = randInt(-200, -20);
    for (let i = 0; i < 5; i += 1) {
      const y = d.y - i * 15;
      if (y >= 0 && y < HEIGHT) text(String.fromCharCode(randInt(33, 126)), d.x, y, 24, [0, 255 - i * 40, 0], "left", "top");
    }
  }
}

function bgScoreSpotlights() {
  ctx.fillStyle = "rgb(20,20,30)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const t = bgTick * 0.002;
  for (let i = 0; i < 3; i += 1) {
    const x = WIDTH / 4 * (i + 1);
    const angle = Math.sin(t + i) * 0.5;
    const end = v(x + Math.sin(angle) * 400, HEIGHT / 2 - Math.cos(angle) * 400);
    line(v(x, HEIGHT), end, WHITE, 2);
    poly([v(x, HEIGHT), v(end.x - 20, end.y), v(end.x + 20, end.y)], "rgba(255,255,255,0.08)");
  }
}

const BACKGROUND_LIBRARY = [
  ["Particle Swarm", bgMenuParticles, "menu_particles"],
  ["Neon City", bgMenuNeon, "menu_neon"],
  ["Traffic Flow", bgMenuTraffic, "menu_traffic"],
  ["Starfield", bgMenuStars, "menu_stars"],
  ["Digital Rain", bgMenuRain, "menu_rain"],
  ["Blueprint", bgGarageBlueprint, "garage_blueprint"],
  ["Garage Spotlights", bgGarageSpotlight, "garage_spotlights"],
  ["Hex Tech", bgGarageHex, "garage_hex"],
  ["Smoke", bgGarageSmoke, "garage_smoke"],
  ["Scanner", bgGarageScan, "garage_scanner"],
  ["Radar", bgMapRadar, "map_radar"],
  ["Digital Bits", bgMapDigital, "map_digital"],
  ["Topography", bgMapTopo, "map_topography"],
  ["Grid Waves", bgMapGridwave, "map_grid_waves"],
  ["Static", bgMapStatic, "map_static"],
  ["Confetti", bgScoreConfetti, "score_confetti"],
  ["Fireworks", bgScoreFireworks, "score_fireworks"],
  ["Gold Rush", bgScoreGold, "score_gold"],
  ["Matrix", bgScoreMatrix, "score_matrix"],
  ["Score Spotlights", bgScoreSpotlights, "score_spotlights"],
];

function backgroundIndex(id) {
  return BACKGROUND_LIBRARY.findIndex(([, , backgroundId]) => backgroundId === id);
}

const BG_CATEGORIES = {
  menu: { name: "Main Menu", selected: backgroundIndex("menu_particles"), options: BACKGROUND_LIBRARY },
  garage: { name: "Garage", selected: backgroundIndex("garage_hex"), options: BACKGROUND_LIBRARY },
  map: { name: "Map Editor", selected: backgroundIndex("map_topography"), options: BACKGROUND_LIBRARY },
  score: { name: "Scoreboard", selected: backgroundIndex("menu_particles"), options: BACKGROUND_LIBRARY },
};
const DEFAULT_BACKGROUND_SELECTIONS = Object.fromEntries(
  Object.entries(BG_CATEGORIES).map(([key, category]) => [key, category.options[category.selected][2]]),
);

const BACKGROUNDS_PER_PAGE = 6;
let backgroundLibraryPage = 0;

function getGameSettingsStorageKey() {
  if (!currentUser) return null;
  return `${GAME_SETTINGS_STORAGE_PREFIX}${currentUser.source}:${currentUser.key}`;
}

function resetGameSettingsToDefaults(resetBackgrounds = true) {
  selectedMapIndex = 0;
  selectedThemeIndex = 0;
  obstacleShape = "circle";
  obstacleColor = [...FULL_PALETTE[64]];
  selectedTime = 30;
  selectedCarIndex = 2;
  selectedCar = CAR_MODELS[selectedCarIndex].id;
  selectedColor = [...FULL_PALETTE[47]];
  selectedBoostColor = [...FULL_PALETTE[83]];
  THEMES.forEach((theme, index) => {
    theme.bg = [...DEFAULT_THEME_SETTINGS[index].bg];
    if (DEFAULT_THEME_SETTINGS[index].lineColor) theme.lineColor = [...DEFAULT_THEME_SETTINGS[index].lineColor];
  });
  if (resetBackgrounds) {
    Object.entries(BG_CATEGORIES).forEach(([key, category]) => {
      const defaultId = DEFAULT_BACKGROUND_SELECTIONS[key];
      const defaultIndex = category.options.findIndex(([, , id]) => id === defaultId);
      if (defaultIndex >= 0) category.selected = defaultIndex;
    });
  }
  obstacles = MAPS[selectedMapIndex].pos;
}

function saveGameSettings() {
  try {
    const storageKey = getGameSettingsStorageKey();
    if (!storageKey) return;
    const backgrounds = Object.fromEntries(
      Object.entries(BG_CATEGORIES).map(([key, category]) => [key, category.options[category.selected][2]]),
    );
    const settings = {
      selectedMapIndex,
      selectedThemeIndex,
      obstacleShape,
      obstacleColor,
      selectedTime,
      selectedCarIndex,
      selectedColor,
      selectedBoostColor,
      themes: THEMES.map((theme) => ({ bg: theme.bg, lineColor: theme.lineColor || null })),
      backgrounds,
    };
    localStorage.setItem(storageKey, JSON.stringify(settings));
  } catch (_) {
    // The current game remains usable when browser storage is unavailable.
  }
}

function loadGameSettings(preserveBackgrounds = false) {
  resetGameSettingsToDefaults(!preserveBackgrounds);
  try {
    const storageKey = getGameSettingsStorageKey();
    if (!storageKey) return false;
    const rawSettings = localStorage.getItem(storageKey);
    if (!rawSettings) return false;
    const settings = JSON.parse(rawSettings);
    if (Number.isInteger(settings.selectedMapIndex) && MAPS[settings.selectedMapIndex]) selectedMapIndex = settings.selectedMapIndex;
    if (Number.isInteger(settings.selectedThemeIndex) && THEMES[settings.selectedThemeIndex]) selectedThemeIndex = settings.selectedThemeIndex;
    if (["circle", "square", "triangle"].includes(settings.obstacleShape)) obstacleShape = settings.obstacleShape;
    if (Array.isArray(settings.obstacleColor)) obstacleColor = [...settings.obstacleColor];
    if (timeOptions.includes(settings.selectedTime)) selectedTime = settings.selectedTime;
    if (Number.isInteger(settings.selectedCarIndex) && CAR_MODELS[settings.selectedCarIndex]) selectedCarIndex = settings.selectedCarIndex;
    selectedCar = CAR_MODELS[selectedCarIndex].id;
    if (Array.isArray(settings.selectedColor)) selectedColor = [...settings.selectedColor];
    if (Array.isArray(settings.selectedBoostColor)) selectedBoostColor = [...settings.selectedBoostColor];
    if (Array.isArray(settings.themes)) {
      settings.themes.forEach((savedTheme, index) => {
        if (!THEMES[index]) return;
        if (Array.isArray(savedTheme?.bg)) THEMES[index].bg = [...savedTheme.bg];
        if (Array.isArray(savedTheme?.lineColor)) THEMES[index].lineColor = [...savedTheme.lineColor];
      });
    }
    if (settings.backgrounds) {
      Object.entries(BG_CATEGORIES).forEach(([key, category]) => {
        const savedIndex = category.options.findIndex(([, , id]) => id === settings.backgrounds[key]);
        if (savedIndex >= 0) category.selected = savedIndex;
      });
    }
    obstacles = MAPS[selectedMapIndex].pos;
    return true;
  } catch (_) {
    return false;
  }
}

loadGameSettings();

function updateMobileBackground(category) {
  if (!MOBILE_DEVICE || state === "game" || state === "countdown") return;
  const backdrop = document.getElementById("mobile-background");
  if (!(backdrop instanceof HTMLCanvasElement)) return;

  const bounds = backdrop.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2.5);
  const targetWidth = Math.max(1, Math.round(bounds.width * pixelRatio));
  const targetHeight = Math.max(1, Math.round(bounds.height * pixelRatio));
  if (backdrop.width !== targetWidth || backdrop.height !== targetHeight) {
    backdrop.width = targetWidth;
    backdrop.height = targetHeight;
  }

  const g = backdrop.getContext("2d");
  const w = bounds.width;
  const h = bounds.height;
  const t = bgTick * 0.001;
  const backgroundId = BG_CATEGORIES[category].options[BG_CATEGORIES[category].selected][2];
  const seeded = (index, salt = 0) => {
    const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  const wrap = (value, limit) => ((value % limit) + limit) % limit;
  const pathLine = (x1, y1, x2, y2, color, width = 1) => {
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.strokeStyle = color;
    g.lineWidth = width;
    g.stroke();
  };
  const dot = (x, y, radius, color, stroke = false) => {
    g.beginPath();
    g.arc(x, y, Math.max(0, radius), 0, Math.PI * 2);
    if (stroke) {
      g.strokeStyle = color;
      g.stroke();
    } else {
      g.fillStyle = color;
      g.fill();
    }
  };

  g.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  g.clearRect(0, 0, w, h);

  if (backgroundId === "menu_particles") {
    g.fillStyle = "rgb(20,20,25)";
    g.fillRect(0, 0, w, h);
    const colors = ["rgb(50,50,80)", "rgb(80,50,50)", "rgb(50,80,50)"];
    for (let i = 0; i < 150; i += 1) {
      const x = wrap(seeded(i, 1) * w + (seeded(i, 3) - 0.5) * t * 18, w);
      const y = wrap(seeded(i, 2) * h + (seeded(i, 4) - 0.5) * t * 18, h);
      dot(x, y, 1.2 + seeded(i, 5) * 2, colors[i % colors.length]);
    }
  } else if (backgroundId === "menu_neon") {
    const horizon = h * 0.36;
    g.fillStyle = "rgb(10,0,20)";
    g.fillRect(0, 0, w, h);
    const sun = g.createRadialGradient(w / 2, horizon - 55, 4, w / 2, horizon - 55, Math.min(w * 0.2, 80));
    sun.addColorStop(0, "rgb(255,220,80)");
    sun.addColorStop(0.55, "rgb(255,95,30)");
    sun.addColorStop(1, "rgba(255,40,120,0)");
    g.fillStyle = sun;
    g.fillRect(0, 0, w, horizon);
    pathLine(0, horizon, w, horizon, "rgb(220,0,220)", 2);
    for (let i = -8; i <= 8; i += 1) pathLine(w / 2, horizon, w / 2 + i * w * 0.22, h, "rgba(200,0,200,0.55)");
    for (let i = 0; i < 16; i += 1) {
      const progress = wrap(i / 16 + t * 0.08, 1);
      const y = horizon + (h - horizon) * progress * progress;
      pathLine(0, y, w, y, "rgba(200,0,200,0.55)");
    }
  } else if (backgroundId === "menu_traffic") {
    g.fillStyle = "rgb(30,30,30)";
    g.fillRect(0, 0, w, h);
    for (let lane = 1; lane < 6; lane += 1) pathLine(0, h * lane / 6, w, h * lane / 6, "rgba(210,210,190,0.12)", 2);
    for (let i = 0; i < 12; i += 1) {
      const speed = 24 + seeded(i, 4) * 45;
      const x = wrap(seeded(i, 1) * (w + 80) + t * speed, w + 80) - 50;
      const y = h * (0.08 + (i % 6) / 6) + 12;
      g.fillStyle = `hsl(${Math.floor(seeded(i, 2) * 360)} 58% 55%)`;
      g.fillRect(x, y, 42, 20);
      g.fillStyle = "rgb(255,255,205)";
      g.fillRect(x + 40, y + 3, 8, 4);
      g.fillRect(x + 40, y + 13, 8, 4);
    }
  } else if (backgroundId === "menu_stars") {
    g.fillStyle = "rgb(5,5,10)";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 190; i += 1) {
      const speed = 3 + seeded(i, 3) * 16;
      const x = wrap(seeded(i, 1) * w - t * speed, w);
      const brightness = Math.floor(145 + seeded(i, 4) * 110);
      dot(x, seeded(i, 2) * h, 0.6 + seeded(i, 5) * 1.5, `rgb(${brightness},${brightness},${brightness})`);
    }
  } else if (backgroundId === "menu_rain") {
    g.fillStyle = "rgb(10,15,20)";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 170; i += 1) {
      const speed = 90 + seeded(i, 3) * 180;
      const y = wrap(seeded(i, 2) * h + t * speed, h + 25) - 20;
      pathLine(seeded(i, 1) * w, y, seeded(i, 1) * w - 4, y + 16, "rgba(120,150,185,0.62)");
    }
  } else if (backgroundId === "garage_blueprint") {
    g.fillStyle = "rgb(0,50,100)";
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 25) pathLine(x, 0, x, h, x % 100 ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.2)");
    for (let y = 0; y < h; y += 25) pathLine(0, y, w, y, y % 100 ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.2)");
    const radius = Math.min(w * 0.34, 150);
    g.lineWidth = 2;
    dot(w / 2, h / 2, radius, "rgba(255,255,255,0.65)", true);
    dot(w / 2, h / 2, radius * 0.62, "rgba(255,255,255,0.28)", true);
    pathLine(w / 2 - radius - 18, h / 2, w / 2 + radius + 18, h / 2, "rgba(255,255,255,0.5)");
    pathLine(w / 2, h / 2 - radius - 18, w / 2, h / 2 + radius + 18, "rgba(255,255,255,0.5)");
  } else if (backgroundId === "garage_spotlights") {
    g.fillStyle = "rgb(20,20,20)";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3; i += 1) {
      const sourceX = w * (0.2 + i * 0.3) + Math.sin(t + i * 2) * w * 0.18;
      const gradient = g.createLinearGradient(sourceX, 0, w / 2, h);
      gradient.addColorStop(0, i % 2 ? "rgba(200,210,255,0.25)" : "rgba(255,245,200,0.25)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gradient;
      g.beginPath();
      g.moveTo(sourceX - 8, 0);
      g.lineTo(w * 0.18 + i * w * 0.2, h);
      g.lineTo(w * 0.52 + i * w * 0.12, h);
      g.closePath();
      g.fill();
    }
  } else if (backgroundId === "garage_hex") {
    g.fillStyle = "rgb(30,30,35)";
    g.fillRect(0, 0, w, h);
    const garageScale = w / WIDTH;
    const step = 60 * garageScale;
    const radius = 25 * garageScale;
    for (let y = 0, row = 0; y < h + step; y += step, row += 1) {
      for (let x = 0; x < w + step; x += step) {
        const offset = row % 2 === 0 ? step / 2 : 0;
        const logicalX = (x + offset) / garageScale;
        const logicalY = y / garageScale;
        const shade = 40 + Math.trunc(Math.sin(logicalX * 0.01 + logicalY * 0.01 + t * 2) * 20);
        g.lineWidth = Math.max(1, 2 * garageScale);
        dot(x + offset, y, radius, `rgb(${shade},${shade},${shade + 10})`, true);
      }
    }
  } else if (backgroundId === "garage_smoke") {
    g.fillStyle = "rgb(10,10,10)";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 45; i += 1) {
      const y = h - wrap(t * (12 + seeded(i, 3) * 24) + seeded(i, 2) * (h + 160), h + 160) + 80;
      const x = seeded(i, 1) * w + Math.sin(t * 0.5 + i) * 18;
      const radius = 28 + seeded(i, 4) * 65;
      const smoke = g.createRadialGradient(x, y, 0, x, y, radius);
      smoke.addColorStop(0, "rgba(90,90,95,0.09)");
      smoke.addColorStop(1, "rgba(40,40,45,0)");
      g.fillStyle = smoke;
      g.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
  } else if (backgroundId === "garage_scanner") {
    g.fillStyle = "rgb(0,20,0)";
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) pathLine(x, 0, x, h, "rgba(0,80,25,0.5)");
    for (let y = 0; y < h; y += 32) pathLine(0, y, w, y, "rgba(0,55,20,0.25)");
    const scanY = wrap(t * 110, h + 80) - 40;
    const scan = g.createLinearGradient(0, scanY - 35, 0, scanY + 35);
    scan.addColorStop(0, "rgba(0,255,70,0)");
    scan.addColorStop(0.5, "rgba(0,255,70,0.28)");
    scan.addColorStop(1, "rgba(0,255,70,0)");
    g.fillStyle = scan;
    g.fillRect(0, scanY - 35, w, 70);
    pathLine(0, scanY, w, scanY, "rgb(0,255,70)", 2);
  } else if (backgroundId === "map_radar") {
    g.fillStyle = "rgb(0,20,10)";
    g.fillRect(0, 0, w, h);
    const radius = Math.min(w * 0.43, 190);
    for (let y = radius; y < h + radius; y += radius * 2.35) {
      g.lineWidth = 1.5;
      dot(w / 2, y, radius, "rgba(0,115,55,0.7)", true);
      dot(w / 2, y, radius / 2, "rgba(0,115,55,0.5)", true);
      pathLine(w / 2 - radius, y, w / 2 + radius, y, "rgba(0,115,55,0.5)");
      pathLine(w / 2, y - radius, w / 2, y + radius, "rgba(0,115,55,0.5)");
      const angle = t * 1.7;
      pathLine(w / 2, y, w / 2 + Math.cos(angle) * radius, y + Math.sin(angle) * radius, "rgb(0,255,80)", 2);
    }
  } else if (backgroundId === "map_digital") {
    g.fillStyle = "rgb(10,10,15)";
    g.fillRect(0, 0, w, h);
    g.font = "700 20px monospace";
    g.textAlign = "center";
    for (let y = 15; y < h; y += 25) for (let x = 14; x < w; x += 25) {
      const on = seeded(x + Math.floor(t * 4), y) > 0.76;
      g.fillStyle = on ? "rgb(0,115,35)" : "rgb(0,48,20)";
      g.fillText(seeded(x, y + Math.floor(t * 3)) > 0.5 ? "1" : "0", x, y);
    }
  } else if (backgroundId === "map_topography") {
    g.fillStyle = "rgb(30,30,30)";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(135,135,135,0.7)";
    const mapScale = w / WIDTH;
    g.lineWidth = Math.max(1, 2 * mapScale);
    for (let band = 0; band < 5; band += 1) {
      g.beginPath();
      for (let x = 0; x <= w + 10; x += 10) {
        const logicalX = x / mapScale;
        const y = h / 2
          + Math.sin(logicalX * 0.01 + t + band) * 50 * mapScale
          + (band - 2) * 60 * mapScale;
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
  } else if (backgroundId === "map_grid_waves") {
    g.fillStyle = "rgb(20,0,20)";
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h + 30; y += 32) for (let x = 0; x < w + 30; x += 32) {
      dot(x + Math.sin(y * 0.025 + t * 2) * 9, y + Math.cos(x * 0.025 + t * 2) * 9, 2, "rgb(75,15,85)");
    }
  } else if (backgroundId === "map_static") {
    g.fillStyle = "rgb(40,40,40)";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < Math.floor(w * h / 550); i += 1) {
      const frame = Math.floor(t * 12);
      const shade = 40 + Math.floor(seeded(i, frame) * 28);
      g.fillStyle = `rgb(${shade},${shade},${shade})`;
      g.fillRect(seeded(i, frame + 1) * w, seeded(i, frame + 2) * h, 1.5, 1.5);
    }
  } else if (backgroundId === "score_confetti") {
    g.fillStyle = "rgb(20,20,25)";
    g.fillRect(0, 0, w, h);
    const colors = ["#e63c3c", "#ffdc5a", "#00ffff", "#56d75b"];
    for (let i = 0; i < 150; i += 1) {
      const y = wrap(seeded(i, 2) * h + t * (35 + seeded(i, 4) * 80), h + 15) - 10;
      const x = wrap(seeded(i, 1) * w + Math.sin(t + i) * 12, w);
      g.save();
      g.translate(x, y);
      g.rotate(t * (seeded(i, 5) - 0.5) * 3);
      g.fillStyle = colors[i % colors.length];
      g.fillRect(-3, -5, 6, 10);
      g.restore();
    }
  } else if (backgroundId === "score_fireworks") {
    g.fillStyle = "rgb(10,10,20)";
    g.fillRect(0, 0, w, h);
    const colors = ["#e63c3c", "#ffdc5a", "#00ffff", "#bf62ff"];
    for (let burst = 0; burst < 7; burst += 1) {
      const phase = wrap(t * 0.32 + seeded(burst, 4), 1);
      const cx = w * (0.12 + seeded(burst, 1) * 0.76);
      const cy = h * (0.08 + seeded(burst, 2) * 0.82);
      g.strokeStyle = colors[burst % colors.length];
      g.globalAlpha = Math.sin(phase * Math.PI);
      for (let ray = 0; ray < 18; ray += 1) {
        const angle = ray / 18 * Math.PI * 2;
        const inner = phase * 18;
        const outer = phase * (45 + seeded(burst, 3) * 75);
        pathLine(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner, cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer, colors[burst % colors.length], 1.5);
      }
      g.globalAlpha = 1;
    }
  } else if (backgroundId === "score_gold") {
    const gold = g.createLinearGradient(0, 0, 0, h);
    gold.addColorStop(0, "rgb(58,45,0)");
    gold.addColorStop(0.5, "rgb(32,25,0)");
    gold.addColorStop(1, "rgb(58,45,0)");
    g.fillStyle = gold;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 100; i += 1) {
      const y = wrap(seeded(i, 2) * h - t * (10 + seeded(i, 3) * 24), h);
      const brightness = 150 + Math.floor(seeded(i, 4) * 105);
      dot(seeded(i, 1) * w, y, 1 + seeded(i, 5) * 2.5, `rgb(${brightness},${brightness},20)`);
    }
  } else if (backgroundId === "score_matrix") {
    g.fillStyle = "black";
    g.fillRect(0, 0, w, h);
    g.font = "700 18px monospace";
    g.textAlign = "center";
    for (let column = 0; column < Math.ceil(w / 20); column += 1) {
      const head = wrap(seeded(column, 1) * h + t * (45 + seeded(column, 2) * 65), h + 150) - 50;
      for (let trail = 0; trail < 9; trail += 1) {
        const y = head - trail * 19;
        g.fillStyle = trail === 0 ? "rgb(190,255,205)" : `rgba(0,${235 - trail * 20},55,${1 - trail / 10})`;
        g.fillText(String.fromCharCode(33 + Math.floor(seeded(column + trail, Math.floor(t * 7)) * 93)), column * 20 + 10, y);
      }
    }
  } else {
    g.fillStyle = "rgb(20,20,30)";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5; i += 1) {
      const sourceX = w * (i + 1) / 6;
      const endX = w / 2 + Math.sin(t * 1.4 + i) * w * 0.65;
      const beam = g.createLinearGradient(sourceX, h, endX, 0);
      beam.addColorStop(0, "rgba(255,255,255,0.16)");
      beam.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = beam;
      g.beginPath();
      g.moveTo(sourceX - 8, h);
      g.lineTo(endX - 25, 0);
      g.lineTo(endX + 25, 0);
      g.lineTo(sourceX + 8, h);
      g.closePath();
      g.fill();
    }
  }
}

function drawCurrentBg(category) {
  if (MOBILE_DEVICE && document.getElementById("mobile-background") instanceof HTMLCanvasElement) {
    updateMobileBackground(category);
    return;
  }
  BG_CATEGORIES[category].options[BG_CATEGORIES[category].selected][1]();
}

function drawThemeStructure(theme) {
  if (theme.structure === "standard") {
    return;
  } else if (theme.structure === "desert") {
    for (let i = 0; i < 150; i += 1) {
      const x = (i * 83 + 29) % WIDTH;
      const y = (i * 47 + Math.floor(i / 7) * 19) % HEIGHT;
      circle(v(x, y), i % 3 === 0 ? 2 : 1, "rgba(95,60,25,0.20)");
    }
    for (let y = 55; y < HEIGHT; y += 95) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= WIDTH; x += 25) ctx.lineTo(x, y + Math.sin(x * 0.025 + y) * 5);
      ctx.strokeStyle = "rgba(255,245,205,0.16)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  } else if (theme.structure === "ice") {
    const reflections = [[75, 90, 42], [245, 155, 58], [520, 82, 36], [665, 235, 52], [130, 390, 45], [390, 480, 62], [700, 510, 34]];
    ctx.strokeStyle = "rgba(255,255,255,0.38)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (const [x, y, length] of reflections) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + length, y - 8);
      ctx.lineTo(x + length + 13, y - 3);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
  } else {
    const lineColor = theme.lineColor || [200, 0, 200];
    ctx.save();
    ctx.shadowColor = rgb(lineColor);
    ctx.shadowBlur = 14;
    for (let x = 40; x <= WIDTH - 40; x += 60) line(v(x, 0), v(x, HEIGHT), lineColor, 2);
    for (let y = 30; y <= HEIGHT - 30; y += 60) line(v(0, y), v(WIDTH, y), lineColor, 2);
    ctx.restore();
  }
}

function drawBackground() {
  const theme = THEMES[selectedThemeIndex];
  ctx.fillStyle = rgb(theme.bg);
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  drawThemeStructure(theme);
  roundedRect(borderRect, null, rgb(BARREL_WHITE), borderThickness / 2, borderRadius);
  roundedRect(
    rect(borderRect.x + borderInnerInset, borderRect.y + borderInnerInset, borderRect.w - borderInnerInset * 2, borderRect.h - borderInnerInset * 2),
    null,
    rgb(obstacleColor),
    borderThickness,
    borderRadius - borderInnerInset,
  );
}

function drawSingleObstacle(pos, shape, color) {
  const shadow = v(pos.x + 4, pos.y + 4);
  if (shape === "circle") {
    circle(shadow, radius, null, "rgb(10,10,10)", obstacleOuterWidth);
    circle(pos, radius, null, rgb(color), obstacleOuterWidth);
    circle(pos, radius - obstacleInnerInset, null, rgb(BARREL_WHITE), obstacleInnerWidth);
  } else if (shape === "square") {
    const r = rect(pos.x - radius, pos.y - radius, radius * 2, radius * 2);
    roundedRect(rect(r.x + 4, r.y + 4, r.w, r.h), null, "rgb(10,10,10)", obstacleOuterWidth, 5);
    roundedRect(r, null, rgb(color), obstacleOuterWidth, 5);
    roundedRect(rect(r.x + obstacleInnerInset, r.y + obstacleInnerInset, r.w - obstacleInnerInset * 2, r.h - obstacleInnerInset * 2), null, rgb(BARREL_WHITE), obstacleInnerWidth, 4);
  } else {
    const r = radius * 1.2;
    const pts = [v(pos.x, pos.y - r), v(pos.x - r * 0.866, pos.y + r * 0.5), v(pos.x + r * 0.866, pos.y + r * 0.5)];
    const innerScale = (r - obstacleInnerInset) / r;
    const innerPts = pts.map((p) => v(pos.x + (p.x - pos.x) * innerScale, pos.y + (p.y - pos.y) * innerScale));
    poly(pts.map((p) => v(p.x + 4, p.y + 4)), null, "rgb(10,10,10)", obstacleOuterWidth);
    poly(pts, null, rgb(color), obstacleOuterWidth);
    poly(innerPts, null, rgb(BARREL_WHITE), obstacleInnerWidth);
  }
}

function drawObstacles() {
  for (const o of obstacles) drawSingleObstacle(o, obstacleShape, obstacleColor);
}

function drawCollectible() {
  const pulse = Math.sin(bgTick * 0.008) * 3;
  const r = collectibleRadius + pulse;
  circle(collectiblePos, r + 4, "rgb(0,100,100)");
  circle(collectiblePos, r, rgb(NEON_CYAN));
  circle(collectiblePos, r - 5, rgb(WHITE));
}

function drawScore(remainingOverride = null) {
  const box = centeredRect(WIDTH / 2, HEIGHT / 2, 80, 40);
  roundedRect(box, "rgb(0,0,0)", rgb(WHITE), 2, 8);
  text(String(score), WIDTH / 2, HEIGHT / 2, 36);
  const remaining = remainingOverride ?? Math.max(0, selectedTime - (performance.now() - gameStartTime) / 1000);
  text(`${remaining.toFixed(1)}s`, WIDTH - 100, 20, 36, WHITE, "left", "top");
  text("Press ENTER to leave", WIDTH - 20, 60, 24, WHITE, "right", "top");
}

function drawCar(pos, angle, boosting = false, overrideCar = null, overrideColor = null) {
  const rad = angle * Math.PI / 180;
  const dir = v(Math.cos(rad), Math.sin(rad));
  const ortho = v(-dir.y, dir.x);
  const bodyCol = overrideColor || selectedColor;
  const darkCol = darken(bodyCol, 0.4);
  const lightCol = lighten(bodyCol, 1.5);
  const carType = overrideCar || selectedCar;
  let rear = sub(pos, mul(dir, 20));

  if (carType === 1) {
    const frontDist = 15, rearDist = 22, wheelDistWidth = 13, wheelLen = 14, wheelWidth = 12;
    const wheels = [
      add(add(pos, mul(dir, frontDist)), mul(ortho, wheelDistWidth)),
      sub(add(pos, mul(dir, frontDist)), mul(ortho, wheelDistWidth)),
      add(sub(pos, mul(dir, rearDist)), mul(ortho, wheelDistWidth + 2)),
      sub(sub(pos, mul(dir, rearDist)), mul(ortho, wheelDistWidth + 2)),
    ];
    for (const w of wheels) line(pos, w, [40, 40, 40], 4);
    for (const w of wheels) {
      poly([add(add(w, mul(dir, wheelLen / 2)), mul(ortho, wheelWidth / 2)), sub(add(w, mul(dir, wheelLen / 2)), mul(ortho, wheelWidth / 2)), sub(sub(w, mul(dir, wheelLen / 2)), mul(ortho, wheelWidth / 2)), add(sub(w, mul(dir, wheelLen / 2)), mul(ortho, wheelWidth / 2))], "rgb(20,20,25)");
      line(add(w, mul(dir, 4)), sub(w, mul(dir, 4)), [100, 100, 100], 2);
    }
    const nose = add(pos, mul(dir, 25));
    const frontW = add(pos, mul(dir, 15));
    const waist = sub(pos, mul(dir, 5));
    rear = sub(pos, mul(dir, 20));
    const body = [nose, sub(frontW, mul(ortho, 10)), sub(waist, mul(ortho, 8)), sub(rear, mul(ortho, 12)), sub(rear, mul(dir, 5)), add(rear, mul(ortho, 12)), add(waist, mul(ortho, 8)), add(frontW, mul(ortho, 10))];
    poly(body.map((p) => add(p, v(4, 4))), "rgb(0,0,0)");
    poly(body, rgb(bodyCol));
    poly([nose, sub(waist, mul(ortho, 4)), add(waist, mul(ortho, 4))], rgb(lightCol));
    const roof = [add(add(pos, mul(dir, 5)), mul(ortho, 6)), sub(add(pos, mul(dir, 5)), mul(ortho, 6)), sub(sub(pos, mul(dir, 12)), mul(ortho, 7)), add(sub(pos, mul(dir, 12)), mul(ortho, 7))];
    poly(roof, rgb(CAR_WINDOW), rgb(darkCol), 2);
    const spoiler = sub(rear, mul(dir, 8));
    line(add(rear, mul(ortho, 8)), add(spoiler, mul(ortho, 10)), [50, 50, 50], 3);
    line(sub(rear, mul(ortho, 8)), sub(spoiler, mul(ortho, 10)), [50, 50, 50], 3);
    poly([add(add(spoiler, mul(ortho, 16)), mul(dir, 4)), add(sub(spoiler, mul(ortho, 16)), mul(dir, 4)), sub(sub(spoiler, mul(ortho, 16)), mul(dir, 4)), sub(add(spoiler, mul(ortho, 16)), mul(dir, 4))], rgb(darkCol));
  } else if (carType === 2) {
    const nose = add(pos, mul(dir, 24));
    const tail = sub(pos, mul(dir, 22));
    rear = tail;
    const body = [nose, sub(add(pos, mul(dir, 12)), mul(ortho, 13)), sub(pos, mul(ortho, 10)), sub(sub(pos, mul(dir, 10)), mul(ortho, 14)), sub(tail, mul(ortho, 8)), add(tail, mul(ortho, 8)), add(sub(pos, mul(dir, 10)), mul(ortho, 14)), add(pos, mul(ortho, 10)), add(add(pos, mul(dir, 12)), mul(ortho, 13))];
    poly(body.map((p) => add(p, v(4, 4))), "rgb(0,0,0)");
    poly(body, rgb(bodyCol));
    line(add(add(pos, mul(dir, 5)), mul(ortho, 5)), sub(nose, mul(ortho, 2)), lightCol, 2);
    line(sub(add(pos, mul(dir, 5)), mul(ortho, 5)), add(nose, mul(ortho, 2)), lightCol, 2);
    poly([add(add(pos, mul(dir, 2)), mul(ortho, 7)), sub(add(pos, mul(dir, 2)), mul(ortho, 7)), sub(sub(pos, mul(dir, 10)), mul(ortho, 8)), add(sub(pos, mul(dir, 10)), mul(ortho, 8))], rgb(CAR_WINDOW));
  } else if (carType === 3) {
    const nose = add(pos, mul(dir, 26));
    const tail = sub(pos, mul(dir, 24));
    rear = tail;
    const body = [add(nose, mul(ortho, 11)), sub(nose, mul(ortho, 11)), sub(tail, mul(ortho, 11)), add(tail, mul(ortho, 11))];
    poly(body.map((p) => add(p, v(4, 4))), "rgb(0,0,0)");
    poly(body, rgb(bodyCol));
    const scoop = add(pos, mul(dir, 10));
    ctx.fillStyle = rgb(darkCol);
    ctx.fillRect(scoop.x - 4, scoop.y - 4, 8, 8);
    poly([add(sub(pos, mul(dir, 5)), mul(ortho, 9)), sub(sub(pos, mul(dir, 5)), mul(ortho, 9)), sub(sub(pos, mul(dir, 18)), mul(ortho, 9)), add(sub(pos, mul(dir, 18)), mul(ortho, 9))], rgb(CAR_WINDOW));
    line(body[0], body[3], lightCol, 2);
    line(body[1], body[2], lightCol, 2);
  } else if (carType === 4) {
    const nose = add(pos, mul(dir, 18));
    const tail = sub(pos, mul(dir, 22));
    rear = tail;
    const body = [add(nose, mul(ortho, 16)), sub(nose, mul(ortho, 16)), sub(tail, mul(ortho, 16)), add(tail, mul(ortho, 16))];
    poly(body.map((p) => add(p, v(5, 5))), "rgb(0,0,0)");
    poly(body, rgb(bodyCol));
    poly([add(sub(nose, mul(dir, 5)), mul(ortho, 14)), sub(sub(nose, mul(dir, 5)), mul(ortho, 14)), sub(add(tail, mul(dir, 2)), mul(ortho, 14)), add(add(tail, mul(dir, 2)), mul(ortho, 14))], rgb(darkCol));
    circle(tail, 8, "rgb(40,40,40)");
    circle(tail, 4, "rgb(20,20,20)");
  } else if (carType === 5) {
    const nose = add(pos, mul(dir, 30));
    const tail = sub(pos, mul(dir, 20));
    rear = tail;
    const body = [nose, sub(add(pos, mul(dir, 10)), mul(ortho, 5)), sub(tail, mul(ortho, 6)), add(tail, mul(ortho, 6)), add(add(pos, mul(dir, 10)), mul(ortho, 5))];
    poly(body.map((p) => add(p, v(4, 4))), "rgb(0,0,0)");
    poly(body, rgb(bodyCol));
    line(add(sub(nose, mul(dir, 2)), mul(ortho, 14)), sub(sub(nose, mul(dir, 2)), mul(ortho, 14)), lightCol, 4);
    line(add(sub(tail, mul(dir, 5)), mul(ortho, 14)), sub(sub(tail, mul(dir, 5)), mul(ortho, 14)), darkCol, 6);
    circle(sub(pos, mul(dir, 5)), 5, rgb(CAR_WINDOW));
  }

  if (state === "game" || boosting) {
    const origin = sub(rear, mul(dir, 6));
    flameParticles.push({ pos: copy(origin), vel: mul(dir, -(1.5 + Math.random() * 1.5)), life: randInt(12, 22) });
  }
}

function drawFlame() {
  const cLight = lighten(selectedBoostColor, 1.4);
  for (let i = flameParticles.length - 1; i >= 0; i -= 1) {
    const p = flameParticles[i];
    p.pos = add(p.pos, p.vel);
    p.life -= 1;
    circle(p.pos, Math.max(1, Math.floor(p.life / 3)), rgb(p.life > 8 ? selectedBoostColor : cLight));
    if (p.life <= 0) flameParticles.splice(i, 1);
  }
}

function drawBoostedCar(pos, angle, boosting = false, overrideCar = null, overrideColor = null) {
  if (boosting) drawFlame();
  drawCar(pos, angle, boosting, overrideCar, overrideColor);
}

function triggerTeleportEffect(origin) {
  const startedAt = performance.now();
  const particles = [];
  for (let i = 0; i < 28; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 12 + Math.random() * 24;
    particles.push({
      start: v(origin.x + Math.cos(angle) * distance, origin.y + Math.sin(angle) * distance),
      velocity: v(Math.cos(angle) * (10 + Math.random() * 22), -(24 + Math.random() * 42)),
      size: 2 + Math.random() * 4,
      duration: 550 + Math.random() * 350,
    });
  }
  teleportEffect = { origin: copy(origin), particles, startedAt };
}

function drawTeleportEffect() {
  if (!teleportEffect) return;
  const elapsed = performance.now() - teleportEffect.startedAt;
  if (elapsed >= 900) {
    teleportEffect = null;
    return;
  }

  const glowProgress = Math.min(1, elapsed / 700);
  const glowRadius = 44 + glowProgress * 18;
  const gradient = ctx.createRadialGradient(
    teleportEffect.origin.x,
    teleportEffect.origin.y,
    2,
    teleportEffect.origin.x,
    teleportEffect.origin.y,
    glowRadius,
  );
  gradient.addColorStop(0, `rgba(100,210,255,${0.58 * (1 - glowProgress)})`);
  gradient.addColorStop(0.45, `rgba(30,145,255,${0.34 * (1 - glowProgress)})`);
  gradient.addColorStop(1, "rgba(0,80,255,0)");

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(teleportEffect.origin.x, teleportEffect.origin.y, glowRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "rgb(40,160,255)";
  ctx.shadowBlur = 10;
  for (const particle of teleportEffect.particles) {
    const progress = elapsed / particle.duration;
    if (progress >= 1) continue;
    const seconds = elapsed / 1000;
    const size = Math.max(0.5, particle.size * (1 - progress));
    const x = particle.start.x + particle.velocity.x * seconds;
    const y = particle.start.y + particle.velocity.y * seconds;
    ctx.fillStyle = `rgba(70,180,255,${1 - progress})`;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
  }
  ctx.restore();
}

function respawnCar() {
  carPos = copy(MAPS[selectedMapIndex].spawn || v(WIDTH / 2, HEIGHT / 2));
  velocity = 0;
  ignoredStartObstacles.clear();
  triggerTeleportEffect(carPos);
}

function startGame() {
  commitPendingScore();
  pendingScore = null;
  respawnCar();
  if (MOBILE_DEVICE) {
    carPos = v(WIDTH / 2, HEIGHT / 2);
    carAngle = 0;
    ignoredStartObstacles = new Set(obstacles.filter(collidesWithObstacle));
  }
  score = 0;
  collectiblePos = spawnCollectible();
  flameParticles.length = 0;
  physicsAccumulator = 0;
  countdownStartTime = performance.now();
  state = "countdown";
}

function pointInRoundedRect(point, bounds, cornerRadius) {
  if (point.x < bounds.x || point.x > bounds.x + bounds.w || point.y < bounds.y || point.y > bounds.y + bounds.h) return false;
  if (cornerRadius <= 0) return true;
  const nearestX = Math.max(bounds.x + cornerRadius, Math.min(point.x, bounds.x + bounds.w - cornerRadius));
  const nearestY = Math.max(bounds.y + cornerRadius, Math.min(point.y, bounds.y + bounds.h - cornerRadius));
  return dist(point, v(nearestX, nearestY)) <= cornerRadius;
}

function pointToSegmentDistance(point, start, end) {
  const segment = sub(end, start);
  const lengthSquared = segment.x * segment.x + segment.y * segment.y;
  if (lengthSquared === 0) return dist(point, start);
  const offset = sub(point, start);
  const amount = Math.max(0, Math.min(1, (offset.x * segment.x + offset.y * segment.y) / lengthSquared));
  return dist(point, add(start, mul(segment, amount)));
}

function pointInPolygon(point, points) {
  let inside = false;
  for (let i = 0, previous = points.length - 1; i < points.length; previous = i, i += 1) {
    const currentPoint = points[i];
    const previousPoint = points[previous];
    const crosses = (currentPoint.y > point.y) !== (previousPoint.y > point.y)
      && point.x < (previousPoint.x - currentPoint.x) * (point.y - currentPoint.y) / (previousPoint.y - currentPoint.y) + currentPoint.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function collidesWithObstacle(position) {
  const collisionPadding = carCollisionRadius + obstacleOuterWidth / 2;
  if (obstacleShape === "circle") return dist(carPos, position) <= radius + collisionPadding;
  if (obstacleShape === "square") {
    return Math.abs(carPos.x - position.x) <= radius + collisionPadding
      && Math.abs(carPos.y - position.y) <= radius + collisionPadding;
  }

  const triangleRadius = radius * 1.2;
  const points = [
    v(position.x, position.y - triangleRadius),
    v(position.x - triangleRadius * 0.866, position.y + triangleRadius * 0.5),
    v(position.x + triangleRadius * 0.866, position.y + triangleRadius * 0.5),
  ];
  if (pointInPolygon(carPos, points)) return true;
  return points.some((point, index) => pointToSegmentDistance(carPos, point, points[(index + 1) % points.length]) <= collisionPadding);
}

function handleCollisions() {
  for (const obstacle of ignoredStartObstacles) {
    if (!collidesWithObstacle(obstacle)) ignoredStartObstacles.delete(obstacle);
  }
  if (obstacles.some((obstacle) => !ignoredStartObstacles.has(obstacle) && collidesWithObstacle(obstacle))) {
    respawnCar();
    return;
  }

  const playableInset = borderInnerInset + borderThickness / 2 + carCollisionRadius;
  const playableBounds = rect(
    borderRect.x + playableInset,
    borderRect.y + playableInset,
    borderRect.w - playableInset * 2,
    borderRect.h - playableInset * 2,
  );
  const playableRadius = Math.max(0, borderRadius - borderInnerInset - borderThickness / 2 - carCollisionRadius);
  if (!pointInRoundedRect(carPos, playableBounds, playableRadius)) respawnCar();
}

function handleCollect() {
  if (dist(carPos, collectiblePos) < carLength / 2 + collectibleRadius) {
    score += 1;
    collectiblePos = spawnCollectible();
  }
}

function drawButton(name, r, label, fill, size = 36, stroke = null) {
  if (MOBILE_DEVICE) r = scaleMobileUiRect(r, 1.08, 1.22);
  buttons[name] = r;
  roundedRect(r, rgb(fill), stroke ? rgb(stroke) : null, stroke ? 3 : 1, 10);
  fitText(label, r, MOBILE_DEVICE ? size * 1.12 : size);
}

function scaleMobileUiRect(r, factor = 1.1, verticalFactor = factor) {
  if (!MOBILE_DEVICE) return r;
  const width = r.w * factor;
  const height = r.h * verticalFactor;
  return rect(r.x + (r.w - width) / 2, r.y + (r.h - height) / 2, width, height);
}

function mobileScreenHeight() {
  if (!MOBILE_DEVICE) return HEIGHT;
  return Number(canvas.dataset.logicalHeight) || canvas.height / Math.max(1, canvas.width / WIDTH);
}

function drawSelectionTitle(label, fillColor, borderColor) {
  const titleRect = centeredRect(WIDTH / 2, MOBILE_DEVICE ? 62 : 60, MOBILE_DEVICE ? 520 : 500, MOBILE_DEVICE ? 76 : 70);
  roundedRect(titleRect, rgb(fillColor), rgb(borderColor), 4, 10);
  const centeredTextArea = rect(titleRect.x, titleRect.y, titleRect.w, titleRect.h);
  fitText(label, centeredTextArea, MOBILE_DEVICE ? 45 : 42, WHITE, 24, 10, 3, TITLE_FONT_FAMILY);
}

function drawProfileIconButton() {
  const size = MOBILE_DEVICE ? 88 : 54;
  const button = rect(20, MOBILE_DEVICE ? 20 : 20, size, size);
  buttons.profile = button;
  roundedRect(button, rgb(OBSTACLE_MID), null, 1, 10);
  circle(v(button.x + button.w / 2, button.y + button.h * 0.33), button.w * 0.15, rgb(WHITE));
  ctx.beginPath();
  ctx.arc(button.x + button.w / 2, button.y + button.h * 0.78, button.w * 0.26, Math.PI, 0);
  ctx.lineTo(button.x + button.w * 0.76, button.y + button.h * 0.85);
  ctx.lineTo(button.x + button.w * 0.24, button.y + button.h * 0.85);
  ctx.closePath();
  ctx.fillStyle = rgb(WHITE);
  ctx.fill();
}

function drawLeaderboardIconButton() {
  const size = MOBILE_DEVICE ? 88 : 54;
  const button = rect(20, MOBILE_DEVICE ? 122 : 84, size, size);
  buttons.leaderboard = button;
  roundedRect(button, rgb(OBSTACLE_MID), null, 1, 10);
  const crown = [
    v(button.x + button.w * 0.2, button.y + button.h * 0.32),
    v(button.x + button.w * 0.37, button.y + button.h * 0.55),
    v(button.x + button.w * 0.5, button.y + button.h * 0.25),
    v(button.x + button.w * 0.63, button.y + button.h * 0.55),
    v(button.x + button.w * 0.8, button.y + button.h * 0.32),
    v(button.x + button.w * 0.72, button.y + button.h * 0.72),
    v(button.x + button.w * 0.28, button.y + button.h * 0.72),
  ];
  poly(crown, rgb(WHITE));
  roundedRect(rect(button.x + button.w * 0.26, button.y + button.h * 0.76, button.w * 0.48, button.h * 0.08), rgb(WHITE), null, 1, 2);
}

function drawLeaderboardMapPreview(mapIndex, x, y, width, height) {
  const previousObstacles = obstacles;
  obstacles = MAPS[mapIndex].pos;
  const scale = Math.min(width / WIDTH, height / HEIGHT);
  const renderWidth = WIDTH * scale;
  const renderHeight = HEIGHT * scale;
  ctx.save();
  ctx.translate(x + (width - renderWidth) / 2, y + (height - renderHeight) / 2);
  ctx.scale(scale, scale);
  drawBackground();
  drawObstacles();
  ctx.restore();
  obstacles = previousObstacles;
}

function drawLeaderboardCard(mapIndex, bounds, scores) {
  drawScorePanel(bounds, "rgba(24,29,39,0.95)", "rgba(255,255,255,0.2)", 11);
  if (MOBILE_PORTRAIT_LAYOUT) {
    text(MAPS[mapIndex].name, bounds.x + bounds.w / 2, bounds.y + 17, 21, BEIGE);
    const previewWidth = Math.min(150, bounds.w * 0.42);
    const previewHeight = previewWidth * 3 / 4;
    drawLeaderboardMapPreview(mapIndex, bounds.x + 14, bounds.y + 36, previewWidth, previewHeight);
    for (let rank = 0; rank < 3; rank += 1) {
      const rankColors = [[255, 210, 55], [185, 195, 210], [190, 105, 45]];
      const scoreText = scores[rank] === undefined ? "-" : String(scores[rank]);
      const rowY = bounds.y + 48 + rank * Math.max(34, (bounds.h - 62) / 3);
      text(`${rank + 1}.`, bounds.x + 190, rowY, 23, rankColors[rank], "right");
      text(scoreText, bounds.x + 204, rowY, 25, WHITE, "left");
    }
    return;
  }
  text(MAPS[mapIndex].name, bounds.x + bounds.w / 2, bounds.y + 21, 19, BEIGE);
  drawLeaderboardMapPreview(mapIndex, bounds.x + 49, bounds.y + 36, 130, 97);
  for (let rank = 0; rank < 3; rank += 1) {
    const rankColors = [[255, 210, 55], [185, 195, 210], [190, 105, 45]];
    const scoreText = scores[rank] === undefined ? "-" : String(scores[rank]);
    text(`${rank + 1}.`, bounds.x + 66 + rank * 60, bounds.y + 157, 17, rankColors[rank], "right");
    text(scoreText, bounds.x + 72 + rank * 60, bounds.y + 157, 18, WHITE, "left");
  }
}

function drawLeaderboard() {
  drawCurrentBg("menu");
  drawSelectionTitle("Leaderboard", [32, 52, 78], [105, 185, 235]);
  drawBackButton();
  buttons.leaderboardTimes = [];
  const tabWidth = 82;
  const tabGap = 8;
  const totalWidth = timeOptions.length * tabWidth + (timeOptions.length - 1) * tabGap;
  const startX = (WIDTH - totalWidth) / 2;
  for (let index = 0; index < timeOptions.length; index += 1) {
    const duration = timeOptions[index];
    const tabY = MOBILE_PORTRAIT_LAYOUT ? 160 : 108;
    const tab = scaleMobileUiRect(rect(startX + index * (tabWidth + tabGap), tabY, tabWidth, 38), 1.08);
    buttons.leaderboardTimes.push([tab, duration]);
    const selected = duration === leaderboardTime;
    roundedRect(tab, rgb(selected ? YELLOW : OBSTACLE_MID), selected ? rgb(WHITE) : null, selected ? 2 : 1, 7);
    fitText(duration === 60 ? "1 min" : `${duration}s`, tab, 23, selected ? DARK_BROWN : WHITE, 5, 4);
  }

  const allScores = loadTopScores()[leaderboardTime];
  const statsHeight = mobileScreenHeight();
  const cardHeight = MOBILE_PORTRAIT_LAYOUT ? Math.min(220, statsHeight * 0.17) : 178;
  const statsTop = MOBILE_PORTRAIT_LAYOUT ? 260 : 170;
  const statsRowGap = MOBILE_PORTRAIT_LAYOUT ? Math.max(28, (statsHeight - 100 - statsTop - cardHeight * 3) / 2) : 0;
  const statsRowTwo = statsTop + cardHeight + statsRowGap;
  const statsRowThree = statsRowTwo + cardHeight + statsRowGap;
  const cardPositions = MOBILE_PORTRAIT_LAYOUT ? [
    rect(45, statsTop, 340, cardHeight),
    rect(415, statsTop, 340, cardHeight),
    rect(45, statsRowTwo, 340, cardHeight),
    rect(415, statsRowTwo, 340, cardHeight),
    rect(230, statsRowThree, 340, cardHeight),
  ] : [
    rect(28, 166, 228, 178),
    rect(286, 166, 228, 178),
    rect(544, 166, 228, 178),
    rect(157, 364, 228, 178),
    rect(415, 364, 228, 178),
  ];
  for (let index = 0; index < MAPS.length; index += 1) {
    drawLeaderboardCard(index, cardPositions[index], allScores[MAPS[index].name]);
  }
}

function drawProfileScreen() {
  drawCurrentBg("menu");
  drawSelectionTitle("User Profile", [32, 52, 78], [105, 185, 235]);
  drawBackButton();

  if (currentUser) {
    text("Signed in as", WIDTH / 2, 210, 28, BEIGE);
    text(currentUser.username, WIDTH / 2, 260, 42, WHITE);
    drawButton("profileLogout", centeredRect(WIDTH / 2, 350, 260, 54), "Sign Out", RELAXED_RED, 28);
    text("Highscores, settings and statistics", WIDTH / 2, 445, 22, WHITE);
    text("are ready to be stored for this account.", WIDTH / 2, 475, 22, WHITE);
    return;
  }

  const usernameRect = centeredRect(WIDTH / 2, 205, 420, 52);
  const passwordRect = centeredRect(WIDTH / 2, 300, 420, 52);
  buttons.profileUsername = usernameRect;
  buttons.profilePassword = passwordRect;
  text("Account Name", usernameRect.x, usernameRect.y - 12, 22, BEIGE, "left", "bottom");
  text("Password", passwordRect.x, passwordRect.y - 12, 22, BEIGE, "left", "bottom");
  roundedRect(usernameRect, "rgb(28,28,34)", rgb(activeProfileField === "username" ? YELLOW : WHITE), activeProfileField === "username" ? 3 : 2, 8);
  roundedRect(passwordRect, "rgb(28,28,34)", rgb(activeProfileField === "password" ? YELLOW : WHITE), activeProfileField === "password" ? 3 : 2, 8);
  text(profileUsername.slice(-28) || "Enter account name", usernameRect.x + 16, usernameRect.y + usernameRect.h / 2, 24, profileUsername ? WHITE : [125, 125, 135], "left");
  const passwordLabel = profilePassword ? "•".repeat(Math.min(profilePassword.length, 28)) : "Enter password";
  text(passwordLabel, passwordRect.x + 16, passwordRect.y + passwordRect.h / 2, 24, profilePassword ? WHITE : [125, 125, 135], "left");
  drawButton("profileLogin", centeredRect(WIDTH / 2 - 115, 395, 210, 52), "Sign In", OBSTACLE_MID, 28);
  drawButton("profileCreate", centeredRect(WIDTH / 2 + 115, 395, 210, 52), "Create User", OBSTACLE_MID, 28);
  if (profileMessage) text(profileMessage, WIDTH / 2, 475, 20, profileMessage.includes("success") || profileMessage.includes("created") ? KHAKI : WHITE);
}

function drawMenu() {
  buttons.time = [];
  drawCurrentBg("menu");
  drawProfileIconButton();
  drawLeaderboardIconButton();
  const screenHeight = mobileScreenHeight();
  const startY = MOBILE_PORTRAIT_LAYOUT ? Math.max(280, screenHeight * 0.3) : 138;
  const promptY = MOBILE_PORTRAIT_LAYOUT ? startY + 72 : 184;
  const timeTitleY = MOBILE_PORTRAIT_LAYOUT ? screenHeight * 0.47 : 293;
  const timeButtonsY = MOBILE_PORTRAIT_LAYOUT ? timeTitleY + 92 : 343;
  const settingsY = MOBILE_PORTRAIT_LAYOUT ? screenHeight * 0.7 : 490;
  const startRect = centeredRect(WIDTH / 2, startY, MOBILE_PORTRAIT_LAYOUT ? 280 : 200, MOBILE_PORTRAIT_LAYOUT ? 92 : 60);
  buttons.start = startRect;
  roundedRect(startRect, rgb(KHAKI), rgb(WHITE), 3, 10);
  fitText("START", startRect, 72, WHITE, 10, 6, 4);
  if (!MOBILE_DEVICE) text("Press Space to Start", WIDTH / 2, promptY, 18, WHITE);
  text("Choose your Time", WIDTH / 2, timeTitleY, MOBILE_PORTRAIT_LAYOUT ? 44 : 36, BEIGE);
  const total = timeOptions.length * 60 + (timeOptions.length - 1) * 20;
  const startX = (WIDTH - total) / 2;
  for (let i = 0; i < timeOptions.length; i += 1) {
    const t = timeOptions[i];
    const r = scaleMobileUiRect(rect(startX + i * 80, timeButtonsY, 60, 40), 1.1, 1.35);
    buttons.time.push([r, t]);
    roundedRect(r, rgb(t === selectedTime ? YELLOW : DARK_BROWN), null, 1, 5);
    fitText(t < 60 ? `${t}s` : "1m", r, 36, t === selectedTime ? DARK_BROWN : WHITE, 6, 4, 3);
  }
  drawButton("selectCar", centeredRect(WIDTH / 2 - (MOBILE_PORTRAIT_LAYOUT ? 145 : 100), settingsY, MOBILE_PORTRAIT_LAYOUT ? 260 : 180, MOBILE_PORTRAIT_LAYOUT ? 72 : 50), "Car Settings", OBSTACLE_MID, MOBILE_PORTRAIT_LAYOUT ? 32 : 28);
  drawButton("selectMap", centeredRect(WIDTH / 2 + (MOBILE_PORTRAIT_LAYOUT ? 145 : 100), settingsY, MOBILE_PORTRAIT_LAYOUT ? 260 : 180, MOBILE_PORTRAIT_LAYOUT ? 72 : 50), "Map Settings", OBSTACLE_MID, MOBILE_PORTRAIT_LAYOUT ? 32 : 28);
}

function drawBackButton() {
  buttons.back = MOBILE_DEVICE ? rect(WIDTH - 108, 18, 88, 88) : rect(WIDTH - 120, 20, 100, 40);
  roundedRect(buttons.back, rgb(RELAXED_RED), null, 1, 8);
  fitText("Back", buttons.back, 28);
}

function drawCarSelect() {
  buttons.carSelect = [];
  drawCurrentBg("garage");
  drawSelectionTitle("Choose your Ride", [32, 52, 78], [105, 185, 235]);
  const screenHeight = mobileScreenHeight();
  const carRowY = MOBILE_PORTRAIT_LAYOUT ? screenHeight * 0.43 : HEIGHT / 2 - 20;
  const original = selectedCar;
  for (let i = 0; i < CAR_MODELS.length; i += 1) {
    const model = CAR_MODELS[i];
    const x = WIDTH / 2 + (i - 2) * 150;
    const y = MOBILE_PORTRAIT_LAYOUT ? carRowY + Math.abs(i - 2) * 55 : HEIGHT / 2 - 20 + Math.abs(i - 2) * 40;
    const r = centeredRect(x, y, 140, 140);
    buttons.carSelect.push([r, i]);
    ctx.beginPath();
    ctx.ellipse(x, y, 75, 70, 0, 0, Math.PI * 2);
    ctx.fillStyle = model.id === original ? "rgb(50,50,55)" : "rgb(30,30,35)";
    ctx.fill();
    if (model.id === original) {
      ctx.strokeStyle = rgb(YELLOW);
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    selectedCar = model.id;
    drawCar(v(x, y), -90);
    text(model.name, x, y + 90, 24);
  }
  selectedCar = original;
  const colorButtonY = MOBILE_PORTRAIT_LAYOUT ? screenHeight * 0.72 : HEIGHT - 100;
  drawButton("carColor", centeredRect(WIDTH / 2 - (MOBILE_PORTRAIT_LAYOUT ? 165 : 120), colorButtonY, MOBILE_PORTRAIT_LAYOUT ? 280 : 160, MOBILE_PORTRAIT_LAYOUT ? 92 : 50), "Car Colour", OBSTACLE_MID, MOBILE_PORTRAIT_LAYOUT ? 32 : 28);
  drawButton("boostColor", centeredRect(WIDTH / 2 + (MOBILE_PORTRAIT_LAYOUT ? 165 : 120), colorButtonY, MOBILE_PORTRAIT_LAYOUT ? 280 : 160, MOBILE_PORTRAIT_LAYOUT ? 92 : 50), "Boost Colour", OBSTACLE_MID, MOBILE_PORTRAIT_LAYOUT ? 32 : 28);
  drawBackButton();
}

function colorsEqual(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function drawColorGrid(selected, options = {}) {
  const cols = options.cols || 12;
  const box = options.box || (MOBILE_DEVICE ? 36 : 32);
  const gap = options.gap ?? 5;
  const totalWidth = cols * box + (cols - 1) * gap;
  const startX = options.startX ?? (WIDTH - totalWidth) / 2;
  const startY = options.startY ?? 300;
  const buttonKey = options.buttonKey || "colors";
  buttons[buttonKey] = [];
  for (let i = 0; i < FULL_PALETTE.length; i += 1) {
    const c = FULL_PALETTE[i];
    const r = rect(startX + (i % cols) * (box + gap), startY + Math.floor(i / cols) * (box + gap), box, box);
    buttons[buttonKey].push([r, c]);
    roundedRect(r, rgb(c), null, 1, 4);
    if (colorsEqual(c, selected)) roundedRect(rect(r.x - 2, r.y - 2, r.w + 4, r.h + 4), null, rgb(WHITE), 2, 4);
  }
}

function mobilePaletteOptions(buttonKey = "colors") {
  const cols = 12;
  const box = 48;
  const gap = 7;
  const rows = Math.ceil(FULL_PALETTE.length / cols);
  const paletteHeight = rows * box + (rows - 1) * gap;
  return {
    buttonKey,
    cols,
    box,
    gap,
    startY: mobileScreenHeight() - 70 - paletteHeight,
  };
}

function landscapePaletteOptions(buttonKey = "colors") {
  return { buttonKey, cols: 12, box: 28, gap: 4, startX: 400, startY: 175 };
}

function drawMobileCarColorPreview(boosting = false) {
  const previewY = mobileScreenHeight() * 0.38;
  ctx.save();
  ctx.translate(WIDTH / 2, previewY);
  ctx.scale(3.2, 3.2);
  ctx.translate(-WIDTH / 2, -180);
  drawBoostedCar(v(WIDTH / 2, 180), -90, boosting);
  ctx.restore();
}

function drawLandscapeCarColorPreview(boosting = false) {
  ctx.save();
  ctx.translate(215, 315);
  ctx.scale(3.1, 3.1);
  ctx.translate(-WIDTH / 2, -180);
  drawBoostedCar(v(WIDTH / 2, 180), -90, boosting);
  ctx.restore();
}

function drawColorSelect() {
  drawCurrentBg("garage");
  drawBackButton();
  drawSelectionTitle("Choose Car Colour", [32, 52, 78], [105, 185, 235]);
  if (MOBILE_PORTRAIT_LAYOUT) {
    drawMobileCarColorPreview(false);
    drawColorGrid(selectedColor, mobilePaletteOptions());
  } else if (MOBILE_DEVICE) {
    drawLandscapeCarColorPreview(false);
    drawColorGrid(selectedColor, landscapePaletteOptions());
  } else {
    drawCar(v(WIDTH / 2, 180), -90);
    drawColorGrid(selectedColor);
  }
}

function drawBoostColorSelect() {
  drawCurrentBg("garage");
  drawBackButton();
  drawSelectionTitle("Choose Boost Colour", [32, 52, 78], [105, 185, 235]);
  if (MOBILE_PORTRAIT_LAYOUT) {
    drawMobileCarColorPreview(true);
    drawColorGrid(selectedBoostColor, mobilePaletteOptions());
  } else if (MOBILE_DEVICE) {
    drawLandscapeCarColorPreview(true);
    drawColorGrid(selectedBoostColor, landscapePaletteOptions());
  } else {
    drawBoostedCar(v(WIDTH / 2, 180), -90, true);
    drawColorGrid(selectedBoostColor);
  }
}

function drawMapPreview(x, y, w, h) {
  const scale = Math.min(w / WIDTH, h / HEIGHT);
  const renderW = WIDTH * scale;
  const renderH = HEIGHT * scale;
  const renderX = x + (w - renderW) / 2;
  const renderY = y + (h - renderH) / 2;
  ctx.save();
  ctx.translate(renderX, renderY);
  ctx.scale(scale, scale);
  drawBackground();
  drawObstacles();
  ctx.restore();
}

function drawMapSelector(buttonKey, label, value, centerY) {
  const previous = MOBILE_PORTRAIT_LAYOUT ? rect(300, centerY - 40, 94, 80) : rect(370, centerY - 17, 34, 34);
  const valueRect = MOBILE_PORTRAIT_LAYOUT ? rect(404, centerY - 32, 192, 64) : rect(414, centerY - 17, 172, 34);
  const next = MOBILE_PORTRAIT_LAYOUT ? rect(606, centerY - 40, 94, 80) : rect(596, centerY - 17, 34, 34);
  buttons[buttonKey] = [[previous, -1], [next, 1]];
  text(`${label}:`, MOBILE_PORTRAIT_LAYOUT ? 72 : 170, centerY, MOBILE_PORTRAIT_LAYOUT ? 30 : 20, BEIGE, "left");
  fitText(value, valueRect, MOBILE_PORTRAIT_LAYOUT ? 30 : 20, WHITE, 6, 4);
  roundedRect(previous, rgb(OBSTACLE_MID), null, 1, 5);
  roundedRect(next, rgb(OBSTACLE_MID), null, 1, 5);
  fitText("<", previous, MOBILE_PORTRAIT_LAYOUT ? 52 : 27, WHITE, 4, 4);
  fitText(">", next, MOBILE_PORTRAIT_LAYOUT ? 52 : 27, WHITE, 4, 4);
}

function getMobileMapSettingsLayout() {
  const screenHeight = mobileScreenHeight();
  const bottomButtonY = screenHeight - 105;
  const selectorGap = 110;
  const selectorBottom = bottomButtonY - 170;
  const selectorTop = selectorBottom - selectorGap * 2;
  const titleBottom = 100;
  const previewHeight = 375;
  const previewBottomLimit = selectorTop - 40;
  const previewY = titleBottom + (previewBottomLimit - titleBottom - previewHeight) / 2;
  return {
    screenHeight,
    bottomButtonY,
    selectorGap,
    selectorTop,
    preview: rect(150, previewY, 500, previewHeight),
  };
}

function drawMapSettings() {
  drawCurrentBg("map");
  drawSelectionTitle("Map Selection", [32, 52, 78], [105, 185, 235]);
  const mobileLayout = MOBILE_PORTRAIT_LAYOUT ? getMobileMapSettingsLayout() : null;
  const bottomButtonY = MOBILE_PORTRAIT_LAYOUT ? mobileLayout.bottomButtonY : 555;
  const selectorGap = MOBILE_PORTRAIT_LAYOUT ? mobileLayout.selectorGap : 42;
  const selectorTop = MOBILE_PORTRAIT_LAYOUT ? mobileLayout.selectorTop : 409;
  if (MOBILE_PORTRAIT_LAYOUT) {
    const preview = mobileLayout.preview;
    drawMapPreview(preview.x, preview.y, preview.w, preview.h);
  } else {
    drawMapPreview(250, 131, 300, 225);
  }
  drawMapSelector("mapNav", "Obstacle Layout", MAPS[selectedMapIndex].name, selectorTop);
  const shapeName = obstacleShape[0].toUpperCase() + obstacleShape.slice(1);
  drawMapSelector("shapeNav", "Obstacle Shape", shapeName, selectorTop + selectorGap);
  drawMapSelector("themeNav", "Theme", THEMES[selectedThemeIndex].name, selectorTop + selectorGap * 2);
  drawButton("mapColors", centeredRect(270, bottomButtonY, 230, MOBILE_PORTRAIT_LAYOUT ? 64 : 50), "Theme Color", OBSTACLE_MID, 27);
  drawButton("obstacleSettings", centeredRect(530, bottomButtonY, 230, MOBILE_PORTRAIT_LAYOUT ? 64 : 50), "Obstacle Color", OBSTACLE_MID, 27);
  drawBackButton();
}

function drawMapColorSettings() {
  drawCurrentBg("map");
  drawSelectionTitle("Theme Color", [32, 52, 78], [105, 185, 235]);
  if (MOBILE_PORTRAIT_LAYOUT) {
    const preview = getMobileMapSettingsLayout().preview;
    drawMapPreview(preview.x, preview.y, preview.w, preview.h);
  } else if (MOBILE_DEVICE) drawMapPreview(45, 175, 320, 240);
  else drawMapPreview(290, 115, 220, 165);
  const theme = THEMES[selectedThemeIndex];
  drawColorGrid(
    theme.structure === "neon" ? theme.lineColor : theme.bg,
    MOBILE_PORTRAIT_LAYOUT
      ? mobilePaletteOptions("mapBackgroundColors")
      : MOBILE_DEVICE ? landscapePaletteOptions("mapBackgroundColors") : { buttonKey: "mapBackgroundColors" },
  );
  drawBackButton();
}

function drawObstacleSettings() {
  drawCurrentBg("map");
  drawSelectionTitle("Obstacle Color", [32, 52, 78], [105, 185, 235]);
  if (MOBILE_PORTRAIT_LAYOUT) {
    const preview = getMobileMapSettingsLayout().preview;
    drawMapPreview(preview.x, preview.y, preview.w, preview.h);
    drawColorGrid(obstacleColor, mobilePaletteOptions());
  } else if (MOBILE_DEVICE) {
    drawMapPreview(45, 175, 320, 240);
    drawColorGrid(obstacleColor, landscapePaletteOptions());
  } else {
    drawMapPreview(290, 115, 220, 165);
    drawColorGrid(obstacleColor);
  }
  drawBackButton();
}

function drawBackgroundCategories() {
  buttons.bgCategories = [];
  drawCurrentBg("menu");
  text("Background Settings", WIDTH / 2, MOBILE_DEVICE ? 38 : 80, MOBILE_DEVICE ? 52 : 72);
  ["menu", "garage", "map", "score"].forEach((key, i) => {
    const r = centeredRect(WIDTH / 2, 180 + i * 80, MOBILE_DEVICE ? 330 : 300, MOBILE_DEVICE ? 66 : 60);
    buttons.bgCategories.push([r, key]);
    roundedRect(r, rgb(OBSTACLE_MID), null, 1, 10);
    fitText(BG_CATEGORIES[key].name, r, 36);
  });
  drawBackButton();
}

function drawBackgroundSelectSpecific() {
  buttons.bgOptions = [];
  buttons.bgPageNav = [];
  drawCurrentBg(currentBgCategory);
  const cat = BG_CATEGORIES[currentBgCategory];
  text(`${cat.name} Style`, WIDTH / 2, MOBILE_DEVICE ? 38 : 80, MOBILE_DEVICE ? 52 : 72);
  const previewW = 180, previewH = 130, gap = 25, numCols = 3;
  const startX = (WIDTH - (numCols * previewW + (numCols - 1) * gap)) / 2;
  const pageCount = Math.ceil(cat.options.length / BACKGROUNDS_PER_PAGE);
  const pageStart = backgroundLibraryPage * BACKGROUNDS_PER_PAGE;
  cat.options.slice(pageStart, pageStart + BACKGROUNDS_PER_PAGE).forEach((bg, pageIndex) => {
    const i = pageStart + pageIndex;
    const x = startX + (pageIndex % numCols) * (previewW + gap);
    const y = 155 + Math.floor(pageIndex / numCols) * (previewH + gap + 30);
    const r = rect(x, y, previewW, previewH);
    buttons.bgOptions.push([r, i]);
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.translate(r.x, r.y);
    ctx.scale(previewW / WIDTH, previewH / HEIGHT);
    bg[1]();
    ctx.restore();
    roundedRect(r, null, rgb(i === cat.selected ? YELLOW : WHITE), i === cat.selected ? 3 : 1, 5);
    fitText(bg[0], rect(r.x, r.y + r.h + 3, r.w, 26), 24, WHITE, 2, 1);
  });
  const previous = centeredRect(WIDTH / 2 - 90, 560, MOBILE_DEVICE ? 58 : 50, MOBILE_DEVICE ? 42 : 36);
  const next = centeredRect(WIDTH / 2 + 90, 560, MOBILE_DEVICE ? 58 : 50, MOBILE_DEVICE ? 42 : 36);
  buttons.bgPageNav.push([previous, -1], [next, 1]);
  roundedRect(previous, rgb(OBSTACLE_MID), null, 1, 6);
  roundedRect(next, rgb(OBSTACLE_MID), null, 1, 6);
  fitText("<", previous, 28);
  fitText(">", next, 28);
  text(`${backgroundLibraryPage + 1} / ${pageCount}`, WIDTH / 2, 560, 24);
  drawBackButton();
}

function formatTimeMode(duration) {
  return duration === 60 ? "1 Minute" : `${duration} Seconds`;
}

function drawScoreRankGlow(position, rank, elapsed) {
  if (rank === null || elapsed >= 2500) return;
  const colors = [[255, 210, 55], [185, 195, 210], [190, 105, 45]];
  const color = colors[rank];
  const progress = elapsed / 2500;
  const intensity = progress < 0.3 ? progress / 0.3 : 1 - (progress - 0.3) / 0.7;
  const radius = 52 + progress * 160;
  const gradient = ctx.createRadialGradient(position.x, position.y, 4, position.x, position.y, radius);
  gradient.addColorStop(0, rgb(color, 0.95 * intensity));
  gradient.addColorStop(0.42, rgb(color, 0.48 * intensity));
  gradient.addColorStop(1, rgb(color, 0));

  ctx.save();
  if (MOBILE_DEVICE) {
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgb(color, 0.72 * intensity);
  ctx.lineWidth = 4;
  for (let index = 0; index < 18; index += 1) {
    const angle = index * Math.PI / 9;
    const innerRadius = 30 + progress * 12;
    const outerRadius = 62 + progress * 118;
    ctx.beginPath();
    ctx.moveTo(position.x + Math.cos(angle) * innerRadius, position.y + Math.sin(angle) * innerRadius);
    ctx.lineTo(position.x + Math.cos(angle) * outerRadius, position.y + Math.sin(angle) * outerRadius);
    ctx.stroke();
  }
  for (let index = 0; index < 24; index += 1) {
    const angle = index * 2.39996 + progress * 0.45;
    const sparkDistance = 28 + progress * (120 + index % 5 * 10);
    const sparkSize = 1.4 + index % 3 * 0.7;
    const sparkAlpha = intensity * (0.9 - progress * 0.35);
    circle(
      v(position.x + Math.cos(angle) * sparkDistance, position.y + Math.sin(angle) * sparkDistance),
      sparkSize,
      rgb(color, sparkAlpha),
    );
  }
  ctx.restore();
}

function drawScorePanel(bounds, fill = "rgba(20,24,32,0.92)", stroke = "rgba(255,255,255,0.18)", radius = 12) {
  roundedRect(rect(bounds.x + 6, bounds.y + 7, bounds.w, bounds.h), "rgba(0,0,0,0.36)", null, 1, radius);
  roundedRect(bounds, fill, stroke, 2, radius);
}

function drawMissedScoreEffect(bounds, elapsed) {
  if (elapsed >= 1800) return;
  const progress = elapsed / 1800;
  const fade = progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3;
  ctx.save();
  ctx.beginPath();
  ctx.rect(bounds.x, bounds.y, bounds.w, bounds.h);
  ctx.clip();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `rgba(175,75,255,${0.78 * fade})`;
  ctx.shadowColor = "rgb(155,45,255)";
  ctx.shadowBlur = 9;
  ctx.lineWidth = 3;
  for (let index = 0; index < 11; index += 1) {
    const x = bounds.x + 18 + index * (bounds.w - 36) / 10;
    const length = 9 + (index * 11 % 27);
    const travel = (progress * 1.45 + index * 0.11) % 1;
    const y = bounds.y - length + travel * (bounds.h + length * 2);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + length);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRankingRow(bounds, rank, value) {
  const rankColors = [[255, 210, 55], [185, 195, 210], [190, 105, 45]];
  const rankColor = rankColors[Math.min(rank, 2)];
  drawScorePanel(bounds, "rgba(38,43,54,0.96)", rgb(rankColor, 0.48), 9);
  text(`${rank + 1}`, bounds.x + 34, bounds.y + bounds.h / 2, 27, rankColor);
  text(value === undefined ? "-" : String(value), bounds.x + 75, bounds.y + bounds.h / 2, 34, WHITE, "left");
  text("POINTS", bounds.x + bounds.w - 24, bounds.y + bounds.h / 2, 17, [145, 150, 165], "right");
}

function drawScoreboard() {
  drawCurrentBg("score");
  if (pendingScore && pendingScore.rank !== null && performance.now() - pendingScore.endedAt >= 4250) {
    commitPendingScore();
    pendingScore = null;
  }

  const scoreboardOffset = MOBILE_PORTRAIT_LAYOUT ? (mobileScreenHeight() - HEIGHT) / 2 : 0;
  ctx.save();
  if (scoreboardOffset) ctx.translate(0, scoreboardOffset);

  text("Score", WIDTH / 2, 42, 58);
  const modePanel = rect(170, 78, 460, 88);
  drawScorePanel(modePanel, "rgba(32,38,50,0.94)", "rgba(232,194,150,0.48)");
  text(formatTimeMode(scoreboardTime), WIDTH / 2, 105, 30, BEIGE);
  text(scoreboardLayout, WIDTH / 2, 140, 27, WHITE);

  const rankingPanel = rect(180, 182, 440, 232);
  drawScorePanel(rankingPanel);
  text("TOP 3", WIDTH / 2, 207, 25, KHAKI);
  const topScores = loadTopScores()[scoreboardTime][scoreboardLayout];
  const pendingElapsed = pendingScore ? performance.now() - pendingScore.endedAt : 0;
  const qualifies = pendingScore?.rank !== null && pendingScore?.rank !== undefined;
  const moveProgressRaw = qualifies ? Math.max(0, Math.min(1, (pendingElapsed - 2500) / 1150)) : 0;
  const moveProgress = moveProgressRaw * moveProgressRaw * (3 - 2 * moveProgressRaw);

  ctx.save();
  ctx.beginPath();
  ctx.rect(rankingPanel.x, 222, rankingPanel.w, rankingPanel.h - 40);
  ctx.clip();
  for (let index = 0; index < 3; index += 1) {
    if (topScores[index] === undefined) {
      const receivesScore = qualifies && (
        index === pendingScore.rank
        || topScores.some((savedScore, sourceIndex) => savedScore !== undefined && (sourceIndex >= pendingScore.rank ? sourceIndex + 1 : sourceIndex) === index)
      );
      if (receivesScore && moveProgressRaw > 0) continue;
      drawRankingRow(rect(210, 228 + index * 58, 380, 48), index, undefined);
      continue;
    }
    const isDisplaced = qualifies && index >= pendingScore.rank;
    const destinationRank = isDisplaced ? index + 1 : index;
    const rowY = 228 + index * 58 + (isDisplaced ? 58 * moveProgress : 0);
    drawRankingRow(rect(210, rowY, 380, 48), moveProgress > 0.5 ? destinationRank : index, topScores[index]);
  }
  ctx.restore();

  if (pendingScore) {
    const startBounds = rect(245, 430, 310, 60);
    if (!qualifies || moveProgressRaw === 0) {
      drawScorePanel(startBounds, "rgba(28,34,46,0.96)", "rgba(105,185,235,0.5)", 10);
      const scoreY = startBounds.y + startBounds.h / 2;
      const numberText = String(pendingScore.score);
      const numberX = 425;
      ctx.font = `700 31px ${DEFAULT_FONT_FAMILY}`;
      const scorePosition = v(numberX + ctx.measureText(numberText).width / 2, scoreY);
      if (qualifies) drawScoreRankGlow(scorePosition, pendingScore.rank, pendingElapsed);
      else drawMissedScoreEffect(startBounds, pendingElapsed);
      text("New Score:", numberX - 10, scoreY, 31, WHITE, "right");
      text(numberText, numberX, scoreY, 31, WHITE, "left");
    } else {
      const targetBounds = rect(210, 228 + pendingScore.rank * 58, 380, 48);
      const movingBounds = rect(
        startBounds.x + (targetBounds.x - startBounds.x) * moveProgress,
        startBounds.y + (targetBounds.y - startBounds.y) * moveProgress,
        startBounds.w + (targetBounds.w - startBounds.w) * moveProgress,
        startBounds.h + (targetBounds.h - startBounds.h) * moveProgress,
      );
      drawScorePanel(movingBounds, "rgba(38,43,54,0.96)", "rgba(255,255,255,0.24)", 9);
      const scorePosition = v(movingBounds.x + movingBounds.w / 2, movingBounds.y + movingBounds.h / 2);
      const rankColor = [[255, 210, 55], [185, 195, 210], [190, 105, 45]][pendingScore.rank];
      text(`${pendingScore.rank + 1}`, movingBounds.x + 34, scorePosition.y, 27, rankColor);
      text(String(pendingScore.score), movingBounds.x + 75, scorePosition.y, 34, WHITE, "left");
      text("POINTS", movingBounds.x + movingBounds.w - 24, scorePosition.y, 17, [145, 150, 165], "right");
    }
  }
  if (MOBILE_PORTRAIT_LAYOUT) {
    ctx.restore();
    const actionY = mobileScreenHeight() - 135;
    drawButton("replay", centeredRect(230, actionY, 280, 96), "Replay", OBSTACLE_MID, 42);
    drawButton("home", centeredRect(570, actionY, 280, 96), "Home", OBSTACLE_MID, 42);
  } else {
    drawButton("replay", rect(50, HEIGHT - 80, 200, 50), "Replay", OBSTACLE_MID, 36);
    drawButton("home", rect(WIDTH - 250, HEIGHT - 80, 200, 50), "Home", OBSTACLE_MID, 36);
    ctx.restore();
  }
}

function updateGame() {
  const elapsed = (performance.now() - gameStartTime) / 1000;
  if (elapsed >= selectedTime) {
    finishRound();
    return;
  }
  const mobileMagnitude = Math.hypot(mobileInput.x, mobileInput.y);
  if (MOBILE_DEVICE && mobileMagnitude > 0.08) {
    carAngle = Math.atan2(mobileInput.y, mobileInput.x) * 180 / Math.PI;
    velocity = maxSpeed;
  } else if (keys.has("ArrowUp")) velocity = Math.min(maxSpeed, velocity + acceleration);
  else if (keys.has("ArrowDown")) velocity = Math.max(-maxSpeed / 2, velocity - acceleration);
  else if (velocity > 0) velocity = Math.max(0, velocity - stopFriction);
  else if (velocity < 0) velocity = Math.min(0, velocity + stopFriction);

  const currentTurn = Math.abs(velocity) < 2 ? turnSpeed * 1.1 : turnSpeed;
  if (!(MOBILE_DEVICE && mobileMagnitude > 0.08)) {
    if (keys.has("ArrowLeft")) carAngle -= currentTurn;
    if (keys.has("ArrowRight")) carAngle += currentTurn;
  }
  const rad = carAngle * Math.PI / 180;
  const dir = v(Math.cos(rad), Math.sin(rad));
  carPos = add(carPos, mul(dir, velocity));
  if (velocity !== 0) {
    const ortho = v(-dir.y, dir.x);
    carPos = add(carPos, mul(ortho, (1 - driftFactor) * 0.02));
  }
  handleCollisions();
  handleCollect();
}

function drawGameplayScene(remainingOverride = null, showBoost = false) {
  drawBackground();
  drawObstacles();
  drawCollectible();
  drawScore(remainingOverride);
  drawTeleportEffect();
  drawBoostedCar(carPos, carAngle, showBoost);
}

function drawCountdown() {
  const elapsed = (performance.now() - countdownStartTime) / 1000;
  if (elapsed >= 3) {
    gameStartTime = performance.now();
    state = "game";
    return;
  }
  drawGameplayScene(selectedTime, false);
  const number = String(3 - Math.floor(elapsed));
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const countdownY = MOBILE_DEVICE ? HEIGHT / 4 : HEIGHT / 2;
  circle(v(WIDTH / 2, countdownY), 82, "rgba(0,0,0,0.72)", rgb(WHITE), 4);
  text(number, WIDTH / 2, countdownY + 2, 96, WHITE);
}

function drawFrame(now) {
  const dt = Math.min(100, Math.max(0, now - lastFrame));
  lastFrame = now;
  bgTick += dt;
  const renderScale = Math.max(1, canvas.width / WIDTH);
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  ctx.clearRect(0, 0, WIDTH, canvas.height / renderScale);

  if (state === "menu") drawMenu();
  else if (state === "profile") {
    if (MOBILE_DEVICE) drawCurrentBg("menu");
    else drawProfileScreen();
  }
  else if (state === "leaderboard") drawLeaderboard();
  else if (state === "car_select") drawCarSelect();
  else if (state === "color_select") drawColorSelect();
  else if (state === "boost_color_select") drawBoostColorSelect();
  else if (state === "background_categories") drawBackgroundCategories();
  else if (state === "background_select_specific") drawBackgroundSelectSpecific();
  else if (state === "map_settings") drawMapSettings();
  else if (state === "map_color_settings") drawMapColorSettings();
  else if (state === "obstacle_settings") drawObstacleSettings();
  else if (state === "scoreboard") drawScoreboard();
  else if (state === "countdown") drawCountdown();
  else {
    // Keep gameplay at the original 60 Hz simulation rate independently of
    // the display refresh rate. Previously, a 30 FPS phone moved at half the
    // speed of a 60 FPS phone and fluctuating frame rates made steering shake.
    const physicsStep = 1000 / FPS;
    physicsAccumulator = Math.min(physicsAccumulator + dt, physicsStep * 6);
    while (physicsAccumulator >= physicsStep && state === "game") {
      updateGame();
      physicsAccumulator -= physicsStep;
    }
    drawGameplayScene(null, true);
  }
  requestAnimationFrame(drawFrame);
}

function canvasPoint(event) {
  const r = canvas.getBoundingClientRect();
  const interactionHeight = MOBILE_DEVICE && state !== "game" && state !== "countdown" ? mobileScreenHeight() : HEIGHT;
  const logicalY = (event.clientY - r.top) * interactionHeight / r.height;
  return v((event.clientX - r.left) * WIDTH / r.width, logicalY);
}

canvas.addEventListener("pointerdown", (event) => {
  canvas.focus();
  const p = canvasPoint(event);
  const mx = p.x, my = p.y;

  if (state === "menu") {
    if (hit(buttons.profile, mx, my)) state = "profile";
    else if (hit(buttons.leaderboard, mx, my)) state = "leaderboard";
    else if (hit(buttons.start, mx, my)) startGame();
    for (const [r, t] of buttons.time || []) if (hit(r, mx, my)) selectedTime = t;
    if (hit(buttons.selectCar, mx, my)) state = "car_select";
    if (hit(buttons.selectMap, mx, my)) state = "map_settings";
  } else if (state === "leaderboard") {
    if (hit(buttons.back, mx, my)) state = "menu";
    for (const [timeButton, duration] of buttons.leaderboardTimes || []) {
      if (hit(timeButton, mx, my)) leaderboardTime = duration;
    }
  } else if (state === "profile") {
    if (hit(buttons.back, mx, my)) state = "menu";
    else if (currentUser && hit(buttons.profileLogout, mx, my)) logoutUser();
    else if (!currentUser) {
      if (hit(buttons.profileUsername, mx, my)) activeProfileField = "username";
      else if (hit(buttons.profilePassword, mx, my)) activeProfileField = "password";
      else if (hit(buttons.profileLogin, mx, my)) void submitProfile("login");
      else if (hit(buttons.profileCreate, mx, my)) void submitProfile("create");
    }
  } else if (state === "scoreboard") {
    if (hit(buttons.replay, mx, my)) startGame();
    else if (hit(buttons.home, mx, my)) {
      commitPendingScore();
      pendingScore = null;
      state = "menu";
    }
  } else if (state === "car_select") {
    for (const [r, index] of buttons.carSelect || []) {
      if (hit(r, mx, my)) {
        selectedCarIndex = index;
        selectedCar = CAR_MODELS[index].id;
      }
    }
    if (hit(buttons.back, mx, my)) state = "menu";
    if (hit(buttons.carColor, mx, my)) state = "color_select";
    if (hit(buttons.boostColor, mx, my)) state = "boost_color_select";
  } else if (state === "color_select") {
    if (hit(buttons.back, mx, my)) state = "car_select";
    for (const [r, col] of buttons.colors || []) if (hit(r, mx, my)) selectedColor = col;
  } else if (state === "boost_color_select") {
    if (hit(buttons.back, mx, my)) state = "car_select";
    for (const [r, col] of buttons.colors || []) if (hit(r, mx, my)) selectedBoostColor = col;
  } else if (state === "background_categories") {
    if (hit(buttons.back, mx, my)) state = "menu";
    for (const [r, key] of buttons.bgCategories || []) {
      if (hit(r, mx, my)) {
        currentBgCategory = key;
        backgroundLibraryPage = Math.floor(BG_CATEGORIES[key].selected / BACKGROUNDS_PER_PAGE);
        state = "background_select_specific";
      }
    }
  } else if (state === "background_select_specific") {
    if (hit(buttons.back, mx, my)) state = "background_categories";
    for (const [r, idx] of buttons.bgOptions || []) {
      if (hit(r, mx, my)) {
        BG_CATEGORIES[currentBgCategory].selected = idx;
      }
    }
    for (const [r, direction] of buttons.bgPageNav || []) {
      if (hit(r, mx, my)) {
        const pageCount = Math.ceil(BACKGROUND_LIBRARY.length / BACKGROUNDS_PER_PAGE);
        backgroundLibraryPage = (backgroundLibraryPage + direction + pageCount) % pageCount;
      }
    }
  } else if (state === "map_settings") {
    if (hit(buttons.back, mx, my)) state = "menu";
    for (const [r, direction] of buttons.mapNav || []) {
      if (hit(r, mx, my)) {
        selectedMapIndex = (selectedMapIndex + direction + MAPS.length) % MAPS.length;
        obstacles = MAPS[selectedMapIndex].pos;
        collectiblePos = spawnCollectible();
      }
    }
    for (const [r, direction] of buttons.themeNav || []) {
      if (hit(r, mx, my)) selectedThemeIndex = (selectedThemeIndex + direction + THEMES.length) % THEMES.length;
    }
    for (const [r, direction] of buttons.shapeNav || []) {
      if (hit(r, mx, my)) {
        const shapes = ["circle", "square", "triangle"];
        const currentIndex = shapes.indexOf(obstacleShape);
        obstacleShape = shapes[(currentIndex + direction + shapes.length) % shapes.length];
      }
    }
    if (hit(buttons.mapColors, mx, my)) state = "map_color_settings";
    if (hit(buttons.obstacleSettings, mx, my)) state = "obstacle_settings";
  } else if (state === "map_color_settings") {
    if (hit(buttons.back, mx, my)) state = "map_settings";
    for (const [r, col] of buttons.mapBackgroundColors || []) {
      if (hit(r, mx, my)) {
        const theme = THEMES[selectedThemeIndex];
        if (theme.structure === "neon") theme.lineColor = [...col];
        else theme.bg = [...col];
      }
    }
  } else if (state === "obstacle_settings") {
    if (hit(buttons.back, mx, my)) state = "map_settings";
    for (const [r, col] of buttons.colors || []) if (hit(r, mx, my)) obstacleColor = col;
  }
  saveGameSettings();
});

function handleProfileKey(event) {
  if (event.key === "Escape") {
    state = "menu";
    return;
  }
  if (currentUser || profileBusy) return;
  if (event.key === "Tab") {
    activeProfileField = activeProfileField === "username" ? "password" : "username";
    return;
  }
  if (event.key === "Enter") {
    void submitProfile("login");
    return;
  }
  if (event.key === "Backspace") {
    if (activeProfileField === "username") profileUsername = profileUsername.slice(0, -1);
    else profilePassword = profilePassword.slice(0, -1);
    profileMessage = "";
    return;
  }
  if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
  if (activeProfileField === "username" && profileUsername.length < 32) profileUsername += event.key;
  else if (activeProfileField === "password" && profilePassword.length < 64) profilePassword += event.key;
  profileMessage = "";
}

window.addEventListener("keydown", (event) => {
  const editableTarget = event.target instanceof Element
    && event.target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])");
  if (MOBILE_DEVICE && editableTarget) return;

  if (state === "profile") {
    event.preventDefault();
    handleProfileKey(event);
    return;
  }
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Enter"].includes(event.code) || ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) event.preventDefault();
  keys.add(event.key);
  if (state === "menu" && event.code === "Space") startGame();
  else if (state === "game" && event.key === "Enter") state = "menu";
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key);
});

window.CarCatch = {
  getState: () => state,
  getCurrentUser: () => currentUser ? { key: currentUser.key, username: currentUser.username } : null,
  getProfileStatus: () => profileMessage,
  goToMenu: () => {
    state = "menu";
  },
  logout: () => logoutUser(),
  setProfileCredentials: (accountName, password) => {
    profileUsername = accountName;
    profilePassword = password;
  },
  submitProfile: (action) => void submitProfile(action),
  useLocalProfile: (username) => activateDeviceProfile(username),
  setMobileInput: (horizontal, vertical) => {
    mobileInput = {
      x: Math.max(-1, Math.min(1, horizontal)),
      y: Math.max(-1, Math.min(1, vertical)),
    };
  },
};

collectiblePos = spawnCollectible();
requestAnimationFrame(drawFrame);

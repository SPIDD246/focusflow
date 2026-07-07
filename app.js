// ---------- FocusFlow ----------
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const COLORS = ["#6fae7c", "#3f9d7f", "#e6b25f", "#6aa7c4", "#b490d4", "#ef7d5d"];
const WEEKLY_GOAL_H = 14;   // ~2h/ngày theo roadmap ôn thi
const DAILY_GOAL_MIN = 120; // mục tiêu 120 phút học mỗi ngày
const STORE_KEY = "focusflow.v1";

// ---------- State ----------
const DEFAULTS = () => ({
  sessions: [], focusMinutes: 0, focusLog: [], focusByDay: {},
  completions: {}, theme: null,
  reminders: { enabled: false, lead: 10, summary: false },
});
let state = load();

function load() {
  const d = DEFAULTS();
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    if (raw && raw.sessions) return Object.assign(d, raw, { reminders: Object.assign(d.reminders, raw.reminders || {}) });
  } catch (_) {}
  return d;
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

const uid = () => Math.random().toString(36).slice(2, 9);
const todayIdx = () => (new Date().getDay() + 6) % 7; // Mon=0
function isoDay(dt) {
  const d = new Date(dt); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
function mondayDate() { const n = new Date(); n.setHours(0,0,0,0); n.setDate(n.getDate() - todayIdx()); return n; }
function weekDates() { const m = mondayDate(); return DAYS.map((_, i) => { const d = new Date(m); d.setDate(m.getDate() + i); return isoDay(d); }); }
const weekKey = () => isoDay(mondayDate());
function doneMap() { return (state.completions[weekKey()] ||= {}); }

// ---------- Render ----------
const weekEl = document.getElementById("week");

function render() {
  weekEl.innerHTML = "";
  const done = doneMap();
  DAYS.forEach((day, i) => {
    const col = document.createElement("div");
    col.className = "day-col" + (i === todayIdx() ? " today" : "");
    const head = document.createElement("div");
    head.className = "day-head";
    head.innerHTML = `<span>${day}</span>${i === todayIdx() ? '<span class="dot"></span>' : ""}`;
    col.appendChild(head);

    const list = state.sessions.filter((s) => s.day === day).sort((a, b) => a.start.localeCompare(b.start));
    if (!list.length) {
      const e = document.createElement("div");
      e.className = "empty-day"; e.textContent = "No quests";
      col.appendChild(e);
    }
    list.forEach((s) => col.appendChild(sessionEl(s, !!done[s.id])));
    weekEl.appendChild(col);
  });
  renderStats();
  renderHero();
  renderPerks();
  renderQuests();
  renderBoss();
  renderChart();
  renderBadges();
  save();
}

function sessionEl(s, isDone) {
  const el = document.createElement("div");
  el.className = "session" + (isDone ? " done" : "");
  el.style.background = isDone ? undefined : hexToRgba(s.color, 0.1);
  el.innerHTML = `
    <span class="s-bar" style="background:${s.color}"></span>
    <button class="s-del" title="Delete">&times;</button>
    <div class="s-subj">${escapeHtml(s.subject)}</div>
    <div class="s-time">${s.start} · ${fmtDur(s.duration)}</div>
    <button class="s-check" title="Mark done">✓</button>`;
  el.querySelector(".s-del").addEventListener("click", (e) => {
    e.stopPropagation();
    state.sessions = state.sessions.filter((x) => x.id !== s.id);
    render(); toast("Quest removed");
  });
  el.querySelector(".s-check").addEventListener("click", (e) => {
    e.stopPropagation();
    const dm = doneMap();
    if (dm[s.id]) { delete dm[s.id]; }
    else { dm[s.id] = true; burst(e.clientX, e.clientY); toast(`✓ ${s.subject} done · nice work!`); }
    render();
  });
  el.addEventListener("click", () => openModal(s));
  return el;
}

function renderStats() {
  const dm = doneMap();
  const doneCount = state.sessions.filter((s) => dm[s.id]).length;
  const weekFocus = weekDates().reduce((a, d) => a + (state.focusByDay[d] || 0), 0);
  document.getElementById("statSessions").textContent = state.sessions.length;
  document.getElementById("statDone").textContent = doneCount;
  document.getElementById("statFocus").textContent = fmtHrs(weekFocus);
  document.getElementById("statStreak").textContent = streak();
  const focusH = weekFocus / 60;
  document.getElementById("goalFill").style.width = Math.min(100, (focusH / WEEKLY_GOAL_H) * 100) + "%";
  document.getElementById("goalText").textContent = `${focusH.toFixed(1)} / ${WEEKLY_GOAL_H}h`;
  // Mục tiêu phút/ngày
  const todayMin = state.focusByDay[isoDay(new Date())] || 0;
  const dFill = document.getElementById("dailyFill");
  const dText = document.getElementById("dailyText");
  if (dFill && dText) {
    dFill.style.width = Math.min(100, (todayMin / DAILY_GOAL_MIN) * 100) + "%";
    dText.textContent = `${Math.round(todayMin)} / ${DAILY_GOAL_MIN} phút` + (todayMin >= DAILY_GOAL_MIN ? " ✅" : "");
  }
}

function streak() {
  const days = new Set(state.focusLog);
  let n = 0; const d = new Date();
  while (days.has(isoDay(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ---------- Study RPG (Phase 1) ----------
const STAT_DEFS = [
  { key: "int", abbr: "INT", icon: "🧠", name: "Intelligence" },
  { key: "dis", abbr: "DIS", icon: "🎯", name: "Discipline" },
  { key: "foc", abbr: "FOC", icon: "🧘", name: "Focus" },
  { key: "str", abbr: "STR", icon: "💪", name: "Strength" },
];
// Tiers unlock by character level (highest match wins).
// `key` is the image filename used for the anime avatar: avatars/<key>.png (jpg/webp also work).
const TIERS = [
  { min: 30, key: "sage",       title: "Sage",       aura: "#f6c453", glow: true },
  { min: 20, key: "master",     title: "Master",     aura: "#b490d4", glow: true },
  { min: 10, key: "scholar",    title: "Scholar",    aura: "#6aa7c4", glow: false },
  { min: 5,  key: "apprentice", title: "Apprentice", aura: "#6fae7c", glow: false },
  { min: 1,  key: "novice",     title: "Novice",     aura: "#9aa0a6", glow: false },
];
function tierFor(level) { return TIERS.find((t) => level >= t.min) || TIERS[TIERS.length - 1]; }
// XP needed to go from `level` -> `level+1`. 1 XP = 1 focus minute.
// Curve tuned so the early game is fast & rewarding (Lv2 in ~15 min, Lv3 ~1h,
// Lv5 ~5h, Lv10 ~40h) then ramps up steadily for the late game.
function xpToNext(level) { return Math.floor(15 * Math.pow(level, 1.7)); }
function levelInfo(xp) {
  let lv = 1, rem = Math.max(0, Math.floor(xp));
  while (rem >= xpToNext(lv)) { rem -= xpToNext(lv); lv++; }
  return { level: lv, into: rem, need: xpToNext(lv) };
}
function ensureRpg() {
  if (!state.rpg) state.rpg = { xp: 0, stats: {}, seeded: false };
  if (!state.rpg.stats) state.rpg.stats = {};
  STAT_DEFS.forEach((s) => { if (typeof state.rpg.stats[s.key] !== "number") state.rpg.stats[s.key] = 0; });
  if (typeof state.rpg.xp !== "number") state.rpg.xp = 0;
  if (!STAT_DEFS.some((s) => s.key === state.rpg.train)) state.rpg.train = "int"; // stat this session trains
  // Phase 3 counters (lifetime) + unlock-notification memory.
  // `null` means "backfill silently on first render" so pre-existing progress doesn't spam toasts.
  if (typeof state.rpg.totalSessions !== "number") state.rpg.totalSessions = 0; // focus-timer completions
  if (typeof state.rpg.questsClaimed !== "number") state.rpg.questsClaimed = 0;
  if (typeof state.rpg.bossesDefeated !== "number") state.rpg.bossesDefeated = 0;
  if (state.rpg.perksSeen === undefined) state.rpg.perksSeen = null;
  if (state.rpg.achSeen === undefined) state.rpg.achSeen = null;
  // One-time backfill: turn a returning user's past focus minutes into XP so they don't start empty.
  if (!state.rpg.seeded) {
    if (state.focusMinutes > 0 && state.rpg.xp === 0) {
      state.rpg.xp = state.focusMinutes;
      state.rpg.stats.foc = state.focusMinutes;
      state.rpg.stats.int = state.focusMinutes;
    }
    state.rpg.seeded = true;
  }
}
// Award XP + stat points for `mins` of completed focus.
// Returns { gain, levels } · `gain` is the XP after perk multipliers, `levels` is levels gained.
// The stat you chose to "train" this session gets the full points; Focus tracks all
// focus time, Discipline rewards not pausing, Strength grows with your streak.
// Unlocked skill-tree perks (see PERKS) boost the XP/stat gain.
function gainFocus(mins, paused) {
  ensureRpg();
  const target = STAT_DEFS.some((s) => s.key === state.rpg.train) ? state.rpg.train : "int";
  const before = levelInfo(state.rpg.xp).level;
  const perks = unlockedPerks(before);
  let mult = 1;
  if (perks.has("focused")) mult += 0.10;                 // Deep Focus: +10% always
  if (perks.has("scholar") && target === "int") mult += 0.15; // Scholar's Mind: +15% training INT
  if (perks.has("unstoppable")) mult += 0.25;             // Unstoppable: +25% always
  if (perks.has("weekend")) { const wd = new Date().getDay(); if (wd === 0 || wd === 6) mult += 1; } // ×2 Sat/Sun
  const gain = Math.max(1, Math.round(mins * mult));
  const add = (k, v) => { state.rpg.stats[k] += v; };
  state.rpg.xp += gain;
  add(target, gain);                                   // the stat you trained
  if (target !== "foc") add("foc", gain);              // Focus = all time focused
  if (!paused && target !== "dis") add("dis", gain);   // Discipline: finish without pausing
  add("str", Math.max(1, streak()) * (perks.has("grit") ? 2 : 1)); // Grit doubles Strength gains
  state.rpg.totalSessions += 1;
  const after = levelInfo(state.rpg.xp).level;
  return { gain, levels: after - before };
}
// Grant a flat XP reward (quests, boss). Optionally credits one stat too. Returns levels gained.
function grantXp(amount, statKey) {
  ensureRpg();
  const before = levelInfo(state.rpg.xp).level;
  state.rpg.xp += amount;
  if (statKey && typeof state.rpg.stats[statKey] === "number") state.rpg.stats[statKey] += amount;
  return levelInfo(state.rpg.xp).level - before;
}
// Shared level-up celebration (confetti + toast + notification + full-screen flash).
function celebrateLevels(gained) {
  if (gained <= 0) return;
  const lv = levelInfo(state.rpg.xp).level, tier = tierFor(lv);
  setTimeout(() => {
    burst(window.innerWidth / 2, window.innerHeight / 3);
    toast(`⬆️ LEVEL UP! You reached Level ${lv} · ${tier.title}`);
    flashLevelUp(lv, tier);
  }, 700);
  notify("⬆️ Level Up!", `You just hit Level ${lv} · ${tier.title}!`);
}
// Full-screen radial flash + big "LEVEL UP" readout, themed to the tier you just reached.
function flashLevelUp(level, tier) {
  const el = document.getElementById("levelFlash");
  if (!el) return;
  el.style.setProperty("--tier", tier.aura);
  document.getElementById("lfLevel").textContent = level;
  el.classList.remove("active"); void el.offsetWidth; // restart animation if triggered again quickly
  el.classList.add("active");
  clearTimeout(flashLevelUp._t);
  flashLevelUp._t = setTimeout(() => el.classList.remove("active"), 1500);
}
// Inline SVG character that evolves with level (accessories unlock by tier).
function avatarSVG(level) {
  const t = tierFor(level);
  const glasses = level >= 5 ? `<g stroke="#2b2b2b" stroke-width="2" fill="none"><circle cx="51" cy="54" r="5.5"/><circle cx="69" cy="54" r="5.5"/><path d="M56.5 54 h7"/></g>` : "";
  const cap = level >= 10 ? `<g><path d="M36 30 l24 -11 24 11 -24 11 z" fill="#2b2b2b"/><path d="M50 38 v7 q10 6 20 0 v-7" fill="#2b2b2b" opacity=".9"/><rect x="83" y="30" width="2.4" height="12" fill="#2b2b2b"/><circle cx="84.2" cy="43" r="3" fill="${t.aura}"/></g>` : "";
  const glow = t.glow ? `<circle cx="60" cy="60" r="50" fill="none" stroke="${t.aura}" stroke-width="2.5" opacity=".55"/>` : "";
  const sparkle = t.glow ? `<g fill="${t.aura}"><text x="14" y="40" font-size="15">✦</text><text x="96" y="52" font-size="11">✦</text><text x="20" y="96" font-size="10">✦</text></g>` : "";
  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
    <circle cx="60" cy="60" r="50" fill="${t.aura}" opacity="0.15"/>
    ${glow}
    <path d="M30 116 q30 -32 60 0 z" fill="#6a8caf"/>
    <circle cx="60" cy="54" r="24" fill="#f1d2b0"/>
    <path d="M36 52 q0 -27 24 -27 q24 0 24 27 q-7 -13 -24 -13 q-17 0 -24 13 z" fill="#3a2c22"/>
    <circle cx="51" cy="54" r="2.4" fill="#3a2c22"/>
    <circle cx="69" cy="54" r="2.4" fill="#3a2c22"/>
    <path d="M53 62 q7 6 14 0" stroke="#b06a52" stroke-width="2" fill="none" stroke-linecap="round"/>
    ${glasses}
    ${cap}
    ${sparkle}
  </svg>`;
}
// --- Character portrait, saved in the browser (IndexedDB) so it works offline ---
let userAvatarURL = null; // object URL of the user's uploaded photo, if any
function avatarDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("focusflow-avatar", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("img");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function avatarGet() {
  const db = await avatarDB();
  return new Promise((res, rej) => {
    const q = db.transaction("img").objectStore("img").get("current");
    q.onsuccess = () => res(q.result || null);
    q.onerror = () => rej(q.error);
  });
}
async function avatarPut(blob) {
  const db = await avatarDB();
  return new Promise((res, rej) => {
    const t = db.transaction("img", "readwrite");
    t.objectStore("img").put(blob, "current");
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}
async function loadUserAvatar() {
  try { const b = await avatarGet(); if (b) { userAvatarURL = URL.createObjectURL(b); renderHero(); } } catch (_) {}
}
// Priority: user photo → avatars/avatar.* → avatars/<tier>.* → drawn SVG (never empty).
function renderAvatar(level) {
  const t = tierFor(level);
  const av = document.getElementById("heroAvatar");
  if (!av) return;
  const show = (src) => { av.innerHTML = ""; const img = new Image(); img.className = "hero-img"; img.alt = t.title; img.src = src; av.appendChild(img); };
  if (userAvatarURL) { show(userAvatarURL); return; }
  av.innerHTML = avatarSVG(level); // always-present fallback
  const exts = ["png", "jpg", "jpeg", "webp"];
  const files = exts.map((e) => `avatars/avatar.${e}`).concat(exts.map((e) => `avatars/${t.key}.${e}`));
  let i = 0;
  (function tryNext() {
    if (i >= files.length) return; // no image found · keep the SVG
    const img = new Image();
    img.onload = () => { av.innerHTML = ""; img.className = "hero-img"; img.alt = t.title; av.appendChild(img); };
    img.onerror = () => { i++; tryNext(); };
    img.src = files[i];
  })();
}
function renderHero() {
  ensureRpg();
  const info = levelInfo(state.rpg.xp);
  const t = tierFor(info.level);
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  renderAvatar(info.level);
  set("heroTitle", t.title);
  set("heroLevel", info.level);
  set("xpText", `${info.into} / ${info.need} XP`);
  const frame = document.getElementById("heroFrame");
  if (frame) { frame.style.setProperty("--tier", t.aura); frame.classList.toggle("glow-tier", !!t.glow); }
  const xf = document.getElementById("xpFill"); if (xf) xf.style.width = Math.min(100, (info.into / info.need) * 100) + "%";
  const bars = document.getElementById("statBars");
  if (bars) {
    bars.innerHTML = STAT_DEFS.map((s) => {
      const si = levelInfo(state.rpg.stats[s.key] || 0);
      const pct = Math.min(100, (si.into / si.need) * 100);
      return `<div class="stat-card c-${s.key}">
        <div class="stat-top"><span class="stat-abbr">${s.abbr}</span><span class="stat-lv"><b>${si.level}</b><i>LV</i></span></div>
        <div class="stat-track"><span class="stat-fill" style="width:${pct}%"></span></div>
        <div class="stat-foot"><span class="stat-name">${s.name}</span><span class="stat-xp">${si.into}/${si.need}</span></div>
      </div>`;
    }).join("");
  }
  renderRadar();
}
// 4-axis radar (INT top, DIS right, FOC bottom, STR left) showing each stat's level.
// The shape is relative · the strongest stat reaches the edge so you see your build at a glance.
const RADAR_COLOR = { int: "#5fb0d6", dis: "#ecb44e", foc: "#6fce88", str: "#f2795f" };
function renderRadar() {
  const box = document.getElementById("statRadar");
  if (!box) return;
  const C = 90, R = 60; // center, max radius
  const dirs = { int: [0, -1], dis: [1, 0], foc: [0, 1], str: [-1, 0] };
  const levels = {}; let maxLv = 1;
  STAT_DEFS.forEach((s) => { const lv = levelInfo(state.rpg.stats[s.key] || 0).level; levels[s.key] = lv; if (lv > maxLv) maxLv = lv; });
  const pt = (key, frac) => `${(C + dirs[key][0] * R * frac).toFixed(1)},${(C + dirs[key][1] * R * frac).toFixed(1)}`;
  const order = ["int", "dis", "foc", "str"];
  // grid rings
  const rings = [0.34, 0.67, 1].map((f) =>
    `<polygon points="${order.map((k) => pt(k, f)).join(" ")}" fill="none" stroke="var(--card-brd)" stroke-width="1"/>`).join("");
  const axes = order.map((k) => `<line x1="${C}" y1="${C}" x2="${pt(k, 1).split(",")[0]}" y2="${pt(k, 1).split(",")[1]}" stroke="var(--card-brd)" stroke-width="1"/>`).join("");
  // data polygon (min 0.16 so tiny stats still show)
  const dataPts = order.map((k) => pt(k, Math.max(0.16, levels[k] / maxLv))).join(" ");
  const verts = order.map((k) => { const [x, y] = pt(k, Math.max(0.16, levels[k] / maxLv)).split(","); return `<circle cx="${x}" cy="${y}" r="3.5" fill="${RADAR_COLOR[k]}"/>`; }).join("");
  const ab = {}; STAT_DEFS.forEach((s) => { ab[s.key] = s.abbr; });
  const labels =
    `<text x="${C}" y="4" text-anchor="middle">${ab.int}</text>` +
    `<text x="${C + R + 20}" y="${C + 4}" text-anchor="start">${ab.dis}</text>` +
    `<text x="${C}" y="${C + R + 26}" text-anchor="middle">${ab.foc}</text>` +
    `<text x="${C - R - 20}" y="${C + 4}" text-anchor="end">${ab.str}</text>`;
  box.innerHTML = `<svg viewBox="-16 -8 212 200" xmlns="http://www.w3.org/2000/svg" class="radar-svg">
    ${rings}${axes}
    <polygon points="${dataPts}" fill="var(--accent)" fill-opacity="0.22" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>
    ${verts}
    <g class="radar-labels">${labels}</g>
  </svg>`;
}
// Chips to pick which stat the next focus session trains.
function buildTrainChips() {
  const box = document.getElementById("trainChips");
  if (!box) return;
  ensureRpg();
  box.innerHTML = STAT_DEFS.map((s) =>
    `<button class="train-chip c-${s.key}${state.rpg.train === s.key ? " active" : ""}" data-stat="${s.key}" title="${s.name}">${s.abbr}</button>`).join("");
  box.querySelectorAll(".train-chip").forEach((btn) => btn.addEventListener("click", () => {
    state.rpg.train = btn.dataset.stat; save();
    box.querySelectorAll(".train-chip").forEach((b) => b.classList.toggle("active", b === btn));
    const def = STAT_DEFS.find((s) => s.key === btn.dataset.stat);
    toast(`Training: ${def.name}`);
  }));
}

// ---------- Study RPG (Phase 3): quests · boss · skill tree ----------

// ---- Skill tree / perks ----
// Auto-unlock by character level. Each perk is a passive bonus applied in gainFocus().
const PERKS = [
  { key: "focused",     lv: 3,  icon: "🎯", name: "Deep Focus",      desc: "+10% XP every session" },
  { key: "grit",        lv: 6,  icon: "💪", name: "Iron Will",       desc: "STR gains are doubled" },
  { key: "scholar",     lv: 10, icon: "📚", name: "Scholar's Mind",  desc: "+15% XP while training INT" },
  { key: "weekend",     lv: 14, icon: "🌙", name: "Weekend Warrior", desc: "XP ×2 on Sat & Sun" },
  { key: "unstoppable", lv: 20, icon: "⚡", name: "Unstoppable",     desc: "+25% XP every session" },
];
// Set of perk keys unlocked at the given level.
function unlockedPerks(level) { return new Set(PERKS.filter((p) => level >= p.lv).map((p) => p.key)); }
function renderPerks() {
  const box = document.getElementById("perkTree");
  if (!box) return;
  ensureRpg();
  const lv = levelInfo(state.rpg.xp).level;
  // First run: remember what's already unlocked so we don't fire notifications for past progress.
  if (state.rpg.perksSeen === null) state.rpg.perksSeen = PERKS.filter((p) => lv >= p.lv).map((p) => p.key);
  const justUnlocked = [];
  PERKS.forEach((p) => {
    if (lv >= p.lv && !state.rpg.perksSeen.includes(p.key)) {
      state.rpg.perksSeen.push(p.key);
      justUnlocked.push(p.key);
      setTimeout(() => toast(`✨ Skill unlocked: ${p.name}!`), 450);
      notify("✨ New skill!", `${p.name} · ${p.desc}`);
    }
  });
  box.innerHTML = PERKS.map((p) => {
    const on = lv >= p.lv;
    return `<div class="perk ${on ? "on" : "off"}" data-perk="${p.key}">
      <div class="perk-node">${on ? p.icon : "🔒"}</div>
      <div class="perk-info">
        <div class="perk-name">${escapeHtml(p.name)}${on ? "" : `<span class="perk-lock">Lv ${p.lv}</span>`}</div>
        <div class="perk-desc">${escapeHtml(p.desc)}</div>
      </div>
    </div>`;
  }).join("");
  // Flash the node of any perk that just unlocked this render, then let it settle into the normal "on" look.
  justUnlocked.forEach((key) => {
    const el = box.querySelector(`.perk[data-perk="${key}"]`);
    if (!el) return;
    el.classList.add("just-unlocked");
    setTimeout(() => el.classList.remove("just-unlocked"), 1800);
  });
}

// ---- Daily quests ----
// Progress is derived from live data (today's focus minutes, sessions, marked-done classes)
// and resets each calendar day. Claiming a completed quest grants bonus XP.
const focusToday = () => state.focusByDay[isoDay(new Date())] || 0;
function doneTodayCount() {
  const dm = doneMap(); const today = DAYS[todayIdx()];
  return state.sessions.filter((s) => s.day === today && dm[s.id]).length;
}
// Pool of possible quests (grouped by category). Each day we randomly draw a fresh set from this.
const sessToday = () => state.quests.sessions || 0;
const QUEST_POOL = [
  { key: "m25", icon: "🔥", label: "Study 25 min today",    goal: 25, unit: " min", reward: 20, cat: "min",  prog: focusToday },
  { key: "m45", icon: "📖", label: "Study 45 min today",    goal: 45, unit: " min", reward: 35, cat: "min",  prog: focusToday },
  { key: "m60", icon: "🎯", label: "Focus for 60 min",      goal: 60, unit: " min", reward: 50, cat: "min",  prog: focusToday },
  { key: "m90", icon: "🚀", label: "Grind 90 min today",    goal: 90, unit: " min", reward: 80, cat: "min",  prog: focusToday },
  { key: "s2",  icon: "⚡", label: "Complete 2 focus runs", goal: 2,  unit: "",      reward: 25, cat: "sess", prog: sessToday },
  { key: "s3",  icon: "⚔️", label: "Complete 3 focus runs", goal: 3,  unit: "",      reward: 40, cat: "sess", prog: sessToday },
  { key: "s5",  icon: "💥", label: "Complete 5 focus runs", goal: 5,  unit: "",      reward: 70, cat: "sess", prog: sessToday },
  { key: "d1",  icon: "✅", label: "Mark 1 class done",     goal: 1,  unit: "",      reward: 15, cat: "done", prog: doneTodayCount },
  { key: "d2",  icon: "📚", label: "Mark 2 classes done",   goal: 2,  unit: "",      reward: 25, cat: "done", prog: doneTodayCount },
];
const questByKey = (k) => QUEST_POOL.find((q) => q.key === k);
// Draw 4 quests for the day: one from each category (min/sess/done) for variety, plus one wildcard.
function pickDailyQuests() {
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const pick = (cat) => rand(QUEST_POOL.filter((q) => q.cat === cat));
  const picks = ["min", "sess", "done"].map((c) => pick(c).key);
  const rest = QUEST_POOL.filter((q) => !picks.includes(q.key));
  if (rest.length) picks.push(rand(rest).key);
  return picks;
}
function ensureQuests() {
  const today = isoDay(new Date());
  if (!state.quests || state.quests.day !== today) {
    state.quests = { day: today, sessions: 0, claimed: {}, picks: pickDailyQuests() };
  } else if (!Array.isArray(state.quests.picks) || !state.quests.picks.length) {
    state.quests.picks = pickDailyQuests();          // migrate a same-day pre-random state
    if (!state.quests.claimed) state.quests.claimed = {};
  }
}
// Today's chosen quests (resolved from stored keys), skipping any keys no longer in the pool.
function todayQuests() { ensureQuests(); return state.quests.picks.map(questByKey).filter(Boolean); }
function renderQuests() {
  const box = document.getElementById("questList");
  if (!box) return;
  const quests = todayQuests();
  box.innerHTML = quests.map((q) => {
    const prog = Math.min(q.goal, q.prog());
    const pct = Math.round((prog / q.goal) * 100);
    const done = q.prog() >= q.goal;
    const claimed = !!state.quests.claimed[q.key];
    const cls = claimed ? "claimed" : done ? "ready" : "todo";
    return `<div class="quest ${cls}">
      <div class="quest-ico" data-cat="${q.cat}">${q.icon}</div>
      <div class="quest-mid">
        <div class="quest-label">${escapeHtml(q.label)}</div>
        <div class="quest-track"><span style="width:${pct}%"></span></div>
        <div class="quest-sub">${prog}/${q.goal}${q.unit}</div>
      </div>
      <button class="quest-claim" data-q="${q.key}" ${done && !claimed ? "" : "disabled"}>${claimed ? "✓" : "+" + q.reward}</button>
    </div>`;
  }).join("");
  box.querySelectorAll(".quest-claim").forEach((b) => b.addEventListener("click", () => claimQuest(b.dataset.q)));
  const cnt = document.getElementById("questCount");
  if (cnt) cnt.textContent = `${quests.filter((q) => state.quests.claimed[q.key]).length}/${quests.length}`;
}
function claimQuest(key) {
  ensureQuests();
  const q = questByKey(key);
  if (!q || !state.quests.picks.includes(key) || state.quests.claimed[key] || q.prog() < q.goal) return;
  state.quests.claimed[key] = true;
  state.rpg.questsClaimed += 1;
  const trained = STAT_DEFS.some((s) => s.key === state.rpg.train) ? state.rpg.train : "int";
  const levels = grantXp(q.reward, trained);
  save(); render();
  burst(window.innerWidth / 2, window.innerHeight / 2);
  toast(`🗡️ Quest complete! +${q.reward} XP`);
  celebrateLevels(levels);
}

// ---- Weekly boss ----
// A boss appears each week with HP measured in focus-minutes. Your weekly focus time is the
// "damage"; hit HP and the boss is defeated (once per week) for a big XP reward.
const BOSSES = [
  { name: "The Procrasti-Sloth",  emoji: "🦥", hp: 120, reward: 60 },
  { name: "Doomscroll Hydra",     emoji: "📱", hp: 180, reward: 90 },
  { name: "Brain Fog Wraith",     emoji: "🌫️", hp: 240, reward: 120 },
  { name: "The Distraction Void", emoji: "🕳️", hp: 210, reward: 110 },
  { name: "Deadline Dragon",      emoji: "🐉", hp: 300, reward: 150 },
];
// Deterministic boss-of-the-week from the Monday date string (no randomness → stable across reloads).
function bossFor(wk) { let h = 0; for (let i = 0; i < wk.length; i++) h = (h * 31 + wk.charCodeAt(i)) | 0; return BOSSES[Math.abs(h) % BOSSES.length]; }
function ensureBoss() {
  const wk = weekKey();
  if (!state.boss || state.boss.week !== wk) state.boss = { week: wk, defeated: false };
}
function renderBoss() {
  const box = document.getElementById("bossCard");
  if (!box) return;
  ensureBoss();
  const boss = bossFor(state.boss.week);
  const dmg = weekDates().reduce((a, d) => a + (state.focusByDay[d] || 0), 0);
  const remaining = Math.max(0, boss.hp - dmg);
  const pct = Math.max(0, Math.min(100, (remaining / boss.hp) * 100));
  const dead = remaining <= 0;
  if (dead && !state.boss.defeated) {
    state.boss.defeated = true;
    state.rpg.bossesDefeated += 1;
    const levels = grantXp(boss.reward, "str");
    save(); renderHero();
    burst(window.innerWidth / 2, window.innerHeight / 2);
    toast(`🏆 Defeated ${boss.name}! +${boss.reward} XP`);
    notify("🏆 Boss defeated!", `You defeated ${boss.name} and earned ${boss.reward} XP!`);
    celebrateLevels(levels);
    const card = document.querySelector(".boss-card");
    if (card) { card.classList.add("boss-shake"); setTimeout(() => card.classList.remove("boss-shake"), 650); }
  }
  box.innerHTML = `
    <div class="boss-head ${dead ? "dead" : ""}">
      <span class="boss-emoji">${boss.emoji}</span>
      <span class="boss-name">${escapeHtml(boss.name)}</span>
      <span class="boss-hp-txt">${dead ? "DEFEATED" : remaining + " HP"}</span>
    </div>
    <div class="boss-bar"><span style="width:${pct}%"></span></div>
    <div class="boss-foot">${dead
      ? `🏆 Earned +${boss.reward} XP · a new boss arrives next week!`
      : `Focus <b>${remaining} more min</b> this week to defeat it · reward <b>+${boss.reward} XP</b>`}</div>`;
}

// ---- Weekly bar chart ----
function renderChart() {
  const chart = document.getElementById("barChart");
  const dates = weekDates();
  const mins = dates.map((d) => state.focusByDay[d] || 0);
  const max = Math.max(30, ...mins);
  chart.innerHTML = "";
  DAYS.forEach((day, i) => {
    const col = document.createElement("div");
    col.className = "bar-col" + (i === todayIdx() ? " is-today" : "");
    const h = Math.round((mins[i] / max) * 100);
    col.innerHTML = `
      <div class="bar-val">${mins[i] ? fmtHrsShort(mins[i]) : ""}</div>
      <div class="bar-track"><div class="bar ${i === todayIdx() ? "today-bar" : ""}" style="height:${mins[i] ? Math.max(4, h) : 0}%"></div></div>
      <div class="bar-label">${day[0]}</div>`;
    chart.appendChild(col);
  });
}


// ---- Badges / achievements ----
// Multi-tier achievements spanning streaks, focus hours, level, sessions, quests & bosses.
function achievements() {
  const st = streak();
  const totalH = state.focusMinutes / 60;
  const lv = levelInfo(state.rpg.xp).level;
  const sess = state.rpg.totalSessions || 0;
  const quests = state.rpg.questsClaimed || 0;
  const bosses = state.rpg.bossesDefeated || 0;
  const dm = doneMap();
  const allDone = state.sessions.length > 0 && state.sessions.every((s) => dm[s.id]);
  return [
    { ico: "🔥", label: "3-day",   sub: "streak",     earned: st >= 3,  tier: "bronze" },
    { ico: "⚡", label: "7-day",   sub: "streak",     earned: st >= 7,  tier: "silver" },
    { ico: "🌙", label: "14-day",  sub: "streak",     earned: st >= 14, tier: "gold" },
    { ico: "🏆", label: "30-day",  sub: "streak",     earned: st >= 30, tier: "legendary" },
    { ico: "⏱️", label: "10 hours",  sub: "focused",  earned: totalH >= 10,  tier: "bronze" },
    { ico: "🌟", label: "50 hours",  sub: "focused",  earned: totalH >= 50,  tier: "silver" },
    { ico: "💯", label: "100 hours", sub: "focused",  earned: totalH >= 100, tier: "gold" },
    { ico: "👑", label: "250 hours", sub: "focused",  earned: totalH >= 250, tier: "legendary" },
    { ico: "🌱", label: "Lv 5",     sub: "level",     earned: lv >= 5,  tier: "bronze" },
    { ico: "📘", label: "Lv 10",    sub: "level",     earned: lv >= 10, tier: "silver" },
    { ico: "🎓", label: "Lv 20",    sub: "level",     earned: lv >= 20, tier: "gold" },
    { ico: "🧙", label: "Lv 30",    sub: "level",     earned: lv >= 30, tier: "legendary" },
    { ico: "🎯", label: "10 runs",   sub: "focus",     earned: sess >= 10,   tier: "bronze" },
    { ico: "🚀", label: "50 runs",   sub: "focus",     earned: sess >= 50,   tier: "gold" },
    { ico: "🗡️", label: "10 quests", sub: "claimed",   earned: quests >= 10, tier: "silver" },
    { ico: "⚔️", label: "5 bosses",  sub: "defeated",  earned: bosses >= 5,  tier: "gold" },
    { ico: "✅", label: "Perfect week", sub: "all done", earned: allDone,    tier: "special" },
  ];
}
function renderBadges() {
  ensureRpg();
  const list = achievements();
  // First run: remember what's already earned so past progress doesn't spam notifications.
  if (state.rpg.achSeen === null) state.rpg.achSeen = list.filter((b) => b.earned).map((b) => b.label);
  list.forEach((b) => {
    if (b.earned && !state.rpg.achSeen.includes(b.label)) {
      state.rpg.achSeen.push(b.label);
      setTimeout(() => toast(`🏅 New achievement: ${b.label} · ${b.sub}!`), 300);
    }
  });
  document.getElementById("badges").innerHTML = list.map((b) => `
    <div class="badge ${b.earned ? "earned" : "locked"}" data-tier="${b.tier}">
      <div class="badge-ico">${b.ico}</div>
      <div class="badge-num">${b.label}</div>
      <div class="badge-sub">${b.sub}</div>
    </div>`).join("");
  const cnt = document.getElementById("achCount");
  if (cnt) cnt.textContent = `${list.filter((b) => b.earned).length}/${list.length}`;
}

// ---------- Modal ----------
const modal = document.getElementById("modal");
const form = document.getElementById("sessionForm");
const swatchWrap = document.getElementById("swatches");
let editingId = null;
let pickedColor = COLORS[0];

COLORS.forEach((c, i) => {
  const sw = document.createElement("div");
  sw.className = "swatch" + (i === 0 ? " sel" : "");
  sw.style.background = c;
  sw.addEventListener("click", () => { pickedColor = c; [...swatchWrap.children].forEach((x) => x.classList.remove("sel")); sw.classList.add("sel"); });
  swatchWrap.appendChild(sw);
});

function openModal(session = null) {
  editingId = session ? session.id : null;
  document.getElementById("modalTitle").textContent = session ? "Edit Quest" : "New Quest";
  document.getElementById("saveBtn").textContent = session ? "Save changes" : "Add Quest";
  if (session) {
    form.subject.value = session.subject; form.day.value = session.day;
    form.start.value = session.start; form.duration.value = session.duration; pickedColor = session.color;
  } else {
    form.reset(); form.day.value = DAYS[todayIdx()]; pickedColor = COLORS[0];
  }
  [...swatchWrap.children].forEach((x, i) => x.classList.toggle("sel", COLORS[i] === pickedColor));
  modal.hidden = false;
}
function closeModal() { modal.hidden = true; editingId = null; }
document.getElementById("openAdd").addEventListener("click", () => openModal());
document.getElementById("cancelBtn").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = { subject: form.subject.value.trim(), day: form.day.value, start: form.start.value, duration: parseInt(form.duration.value, 10), color: pickedColor };
  if (!data.subject) return;
  if (editingId) { Object.assign(state.sessions.find((x) => x.id === editingId), data); toast("Quest updated"); }
  else { state.sessions.push({ id: uid(), ...data }); toast("Quest added"); }
  closeModal(); render();
});

// ---------- Focus timer ----------
const ring = document.getElementById("ringFg");
const RING_LEN = 2 * Math.PI * 52;
ring.style.strokeDasharray = RING_LEN;
const display = document.getElementById("timerDisplay");
const toggleBtn = document.getElementById("timerToggle");
let totalSec = 25 * 60, remaining = totalSec, running = false, tick = null;
let sessionPaused = false; // did the user pause during this session? (affects Discipline XP)
const dingSound = new Audio("music/churchbell.mp3");
dingSound.volume = 0.7;

function paintTimer() {
  const m = Math.floor(remaining / 60), s = remaining % 60;
  display.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  ring.style.strokeDashoffset = RING_LEN * (1 - remaining / totalSec);
}
function startTimer() {
  running = true; toggleBtn.textContent = "❚❚ Pause";
  if (soundWithTimer && soundWithTimer.checked && currentTrack === "off") playMusic(MUSIC_DEFAULT);
  tick = setInterval(() => { remaining--; paintTimer(); if (remaining <= 0) finishTimer(); }, 1000);
}
function pauseTimer() { running = false; toggleBtn.textContent = "⚔ Train"; clearInterval(tick); }
function finishTimer() {
  clearInterval(tick); running = false; toggleBtn.textContent = "⚔ Train";
  if (soundWithTimer && soundWithTimer.checked) stopMusic();
  dingSound.currentTime = 0; dingSound.play().catch(() => {});
  const mins = Math.round(totalSec / 60);
  const day = isoDay(new Date());
  state.focusMinutes += mins;
  state.focusByDay[day] = (state.focusByDay[day] || 0) + mins;
  if (!state.focusLog.includes(day)) state.focusLog.push(day);
  const trained = STAT_DEFS.find((s) => s.key === (state.rpg && state.rpg.train)) || STAT_DEFS[0];
  ensureQuests(); state.quests.sessions += 1;             // counts toward daily quests
  const { gain, levels } = gainFocus(mins, sessionPaused); // Study RPG: XP + stats (+ perk bonuses)
  save(); render();
  remaining = totalSec; sessionPaused = false; paintTimer();
  burst(window.innerWidth / 2, window.innerHeight / 2);
  toast(`+${gain} XP · +${gain} ${trained.abbr} 🎉`);
  notify("⏱️ Focus complete!", `You trained for ${mins} minutes. Keep it up!`);
  celebrateLevels(levels);
}
toggleBtn.addEventListener("click", () => { if (running) { sessionPaused = true; pauseTimer(); } else startTimer(); });
document.getElementById("timerReset").addEventListener("click", () => { pauseTimer(); remaining = totalSec; sessionPaused = false; paintTimer(); });
function setDuration(mins, activeChip) {
  mins = Math.max(1, Math.min(180, Math.round(mins)));
  document.querySelectorAll(".timer-presets .chip").forEach((c) => c.classList.remove("active"));
  if (activeChip) activeChip.classList.add("active");
  totalSec = mins * 60; remaining = totalSec; sessionPaused = false; pauseTimer(); paintTimer();
  return mins;
}
document.querySelectorAll(".timer-presets .chip[data-min]").forEach((chip) => {
  chip.addEventListener("click", () => setDuration(parseInt(chip.dataset.min, 10), chip));
});
const customMin = document.getElementById("customMin");
const customSet = document.getElementById("customSet");
function applyCustom() {
  const val = parseInt(customMin.value, 10);
  if (!val || val < 1) { toast("Enter minutes between 1 and 180"); return; }
  const applied = setDuration(val, customSet);
  customMin.value = applied;
  toast(`Timer set to ${applied} min`);
}
customSet.addEventListener("click", applyCustom);
customMin.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); applyCustom(); } });

// ---------- Theme ----------
const themeMeta = document.getElementById("themeColorMeta");
const themeToggle = document.getElementById("themeToggle");
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  themeToggle.textContent = t === "dark" ? "☀️" : "🌙";
  themeMeta.content = t === "dark" ? "#0f150d" : "#eef4e8";
}
(function initTheme() {
  const t = state.theme || "dark";
  applyTheme(t);
})();
themeToggle.addEventListener("click", () => {
  const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  state.theme = t; save(); applyTheme(t);
});

// ---------- Confetti ----------
const cvs = document.getElementById("confetti");
const ctx = cvs.getContext("2d");
let parts = [], raf = null;
function resizeCvs() { cvs.width = innerWidth; cvs.height = innerHeight; }
addEventListener("resize", resizeCvs); resizeCvs();
function burst(x, y) {
  const cols = ["#6fae7c", "#3f9d7f", "#e6b25f", "#6aa7c4", "#b490d4", "#ef7d5d"];
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2, sp = 4 + Math.random() * 7;
    parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4, g: 0.22, life: 60 + Math.random() * 30, r: 3 + Math.random() * 4, c: cols[(Math.random() * cols.length) | 0], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4 });
  }
  if (!raf) raf = requestAnimationFrame(drawConfetti);
}
function drawConfetti() {
  ctx.clearRect(0, 0, cvs.width, cvs.height);
  parts.forEach((p) => { p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life--;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, p.life / 40);
    ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2); ctx.restore();
  });
  parts = parts.filter((p) => p.life > 0 && p.y < cvs.height + 40);
  if (parts.length) raf = requestAnimationFrame(drawConfetti); else { raf = null; ctx.clearRect(0, 0, cvs.width, cvs.height); }
}

// ---------- Reminders & notifications ----------
const remToggle = document.getElementById("remToggle");
const remLead = document.getElementById("remLead");
const remHint = document.getElementById("remHint");
const leadRow = document.getElementById("leadRow");
const summaryRow = document.getElementById("summaryRow");
const summaryToggle = document.getElementById("summaryToggle");
const notified = new Set();

function syncReminderUI() {
  const on = state.reminders.enabled;
  remToggle.checked = on;
  remLead.value = String(state.reminders.lead);
  summaryToggle.checked = !!state.reminders.summary;
  leadRow.style.display = summaryRow.style.display = on ? "flex" : "none";
  remHint.textContent = on ? `On · pings ${state.reminders.lead} min before each class` : "Off · get a ping before class";
}
function notify(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.ready)
      navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, { body, icon: "icon.svg", badge: "icon.svg" })).catch(() => new Notification(title, { body }));
    else new Notification(title, { body });
  } catch (_) {}
}
remToggle.addEventListener("change", async () => {
  if (remToggle.checked) {
    if (!("Notification" in window)) { toast("This browser doesn't support notifications"); remToggle.checked = false; return; }
    let perm = Notification.permission;
    if (perm !== "granted") perm = await Notification.requestPermission();
    if (perm !== "granted") { toast("Allow notifications to enable reminders"); remToggle.checked = false; return; }
    state.reminders.enabled = true; toast("Reminders on 🔔");
  } else { state.reminders.enabled = false; toast("Reminders off"); }
  save(); syncReminderUI();
});
remLead.addEventListener("change", () => { state.reminders.lead = parseInt(remLead.value, 10); save(); syncReminderUI(); });
summaryToggle.addEventListener("change", () => { state.reminders.summary = summaryToggle.checked; save(); toast(summaryToggle.checked ? "Daily summary on" : "Daily summary off"); });

function checkReminders() {
  if (!state.reminders.enabled || !("Notification" in window) || Notification.permission !== "granted") return;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const today = DAYS[todayIdx()], key = isoDay(now);
  state.sessions.forEach((s) => {
    if (s.day !== today) return;
    const [h, m] = s.start.split(":").map(Number);
    if (nowMin === h * 60 + m - state.reminders.lead) {
      const k = `${s.id}-${key}`;
      if (notified.has(k)) return; notified.add(k);
      notify("📚 " + s.subject, `Starts at ${s.start} · ${fmtDur(s.duration)} · in ${state.reminders.lead} min`);
      toast(`🔔 ${s.subject} in ${state.reminders.lead} min`);
    }
  });
  if (state.reminders.summary && nowMin === 20 * 60) {
    const k = "summary-" + key;
    if (!notified.has(k)) { notified.add(k);
      const mins = state.focusByDay[key] || 0;
      notify("🌙 Daily summary", mins ? `Today you focused for ${fmtHrs(mins)}. Great job!` : "No focus logged today · a short 15-min session still counts!");
    }
  }
}
setInterval(checkReminders, 20000);

// ---------- Export / Import ----------
document.getElementById("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "focusflow-schedule.json"; a.click();
  URL.revokeObjectURL(url); toast("Schedule exported ⭳");
});
const importFile = document.getElementById("importFile");
document.getElementById("importBtn").addEventListener("click", () => importFile.click());
importFile.addEventListener("change", () => {
  const file = importFile.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.sessions)) throw new Error("bad");
      state = Object.assign(DEFAULTS(), data, { reminders: Object.assign(DEFAULTS().reminders, data.reminders || {}) });
      save(); applyTheme(state.theme || document.documentElement.dataset.theme); render(); syncReminderUI();
      toast(`Imported ${state.sessions.length} quests ✓`);
    } catch (_) { toast("Couldn't read that file · invalid format"); }
    importFile.value = "";
  };
  reader.readAsText(file);
});

// ---------- Focus music: local MP3 files ----------
// Built-in songs: drop an .mp3 into music/ and add a line below.
// Users can also add their own songs at runtime · see the picker below.
let TRACKS = [
  { id: "lofi-sleep", file: "music/lofi-sleep.mp3", label: "💤 Lofi Sleep" },
];
const MUSIC_DEFAULT = TRACKS.length ? TRACKS[0].id : "off";

const audio = new Audio();
audio.loop = true;
audio.volume = 0.55;
let currentTrack = "off";

// --- User-uploaded songs, saved in the browser (IndexedDB) so they persist offline ---
function musicDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("focusflow-music", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("tracks", { keyPath: "id" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function dbAll() {
  const db = await musicDB();
  return new Promise((res, rej) => {
    const q = db.transaction("tracks").objectStore("tracks").getAll();
    q.onsuccess = () => res(q.result || []);
    q.onerror = () => rej(q.error);
  });
}
async function dbPut(rec) {
  const db = await musicDB();
  return new Promise((res, rej) => {
    const t = db.transaction("tracks", "readwrite");
    t.objectStore("tracks").put(rec);
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}
async function dbDel(id) {
  const db = await musicDB();
  return new Promise((res, rej) => {
    const t = db.transaction("tracks", "readwrite");
    t.objectStore("tracks").delete(id);
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}
// Turn a saved {id,label,blob} record into a playable track backed by an object URL.
function addUserTrack(rec) {
  TRACKS.push({ id: rec.id, file: URL.createObjectURL(rec.blob), label: "🎵 " + rec.label, user: true });
}

// Build the buttons from TRACKS + a Stop button.
function buildSoundGrid() {
  const grid = document.getElementById("soundGrid");
  if (!grid) return;
  grid.innerHTML =
    TRACKS.map((t) => `<button class="sound-btn${t.user ? " user" : ""}" data-track="${t.id}">${t.label}${t.user ? `<span class="track-x" data-del="${t.id}" title="Remove">✕</span>` : ""}</button>`).join("") +
    '<button class="sound-btn" data-track="off">⏸ Stop</button>';
  grid.querySelectorAll(".sound-btn").forEach((btn) => btn.addEventListener("click", (e) => {
    const del = e.target.closest(".track-x");
    if (del) { e.stopPropagation(); removeUserTrack(del.dataset.del); return; }
    const id = btn.dataset.track;
    if (id === "off") { stopMusic(); toast("Music stopped"); }
    else { playMusic(id); toast("▶ " + btn.textContent.replace("✕", "").trim()); }
  }));
  markSoundBtn(currentTrack);
}
buildSoundGrid();

async function removeUserTrack(id) {
  const t = TRACKS.find((x) => x.id === id);
  if (currentTrack === id) stopMusic();
  if (t && t.file.startsWith("blob:")) URL.revokeObjectURL(t.file);
  TRACKS = TRACKS.filter((x) => x.id !== id);
  try { await dbDel(id); } catch (_) {}
  buildSoundGrid();
  toast("Removed");
}

// Load previously saved user songs on startup.
(async function loadUserTracks() {
  try { (await dbAll()).forEach(addUserTrack); buildSoundGrid(); } catch (_) {}
})();

// "Add your own music" picker.
const musicFile = document.getElementById("musicFile");
document.getElementById("addMusicBtn")?.addEventListener("click", () => musicFile.click());
musicFile?.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []);
  let added = 0;
  for (const f of files) {
    const id = "user-" + f.name.replace(/[^\w]+/g, "-").toLowerCase() + "-" + f.size;
    if (TRACKS.some((t) => t.id === id)) continue;
    const rec = { id, label: f.name.replace(/\.[^.]+$/, ""), blob: f };
    try { await dbPut(rec); addUserTrack(rec); added++; } catch (_) { toast("Couldn't save that song"); }
  }
  buildSoundGrid();
  musicFile.value = "";
  if (added) toast(`Added ${added} song${added > 1 ? "s" : ""} ✓`);
});

// "Đổi ảnh nhân vật" · pick a photo, save it in the browser, use it as the avatar.
const avatarFile = document.getElementById("avatarFile");
document.getElementById("avatarBtn")?.addEventListener("click", () => avatarFile.click());
avatarFile?.addEventListener("change", async (e) => {
  const f = e.target.files && e.target.files[0];
  avatarFile.value = "";
  if (!f) return;
  try {
    await avatarPut(f);
    if (userAvatarURL) URL.revokeObjectURL(userAvatarURL);
    userAvatarURL = URL.createObjectURL(f);
    renderHero();
    toast("Character portrait updated ✓");
  } catch (_) { toast("Couldn't save the image"); }
});
loadUserAvatar();
buildTrainChips();

function markSoundBtn(id) { document.querySelectorAll(".sound-btn").forEach((b) => b.classList.toggle("active", b.dataset.track === id)); }
function playMusic(id) {
  const t = TRACKS.find((x) => x.id === id);
  if (!t) return;
  currentTrack = id; markSoundBtn(id);
  if (!audio.src.endsWith(t.file)) audio.src = t.file;
  audio.play().catch(() => { markSoundBtn("off"); currentTrack = "off"; toast("Add " + t.file + " to play this"); });
}
function stopMusic() { currentTrack = "off"; markSoundBtn("off"); audio.pause(); }
document.getElementById("vol").addEventListener("input", (e) => { audio.volume = (+e.target.value) / 100; });
const soundWithTimer = document.getElementById("soundWithTimer");

// ---------- Add to phone calendar (.ics · native reminders even when app closed) ----------
function icsEsc(t) { return t.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n"); }
function buildICS() {
  const BYDAY = { Mon: "MO", Tue: "TU", Wed: "WE", Thu: "TH", Fri: "FR", Sat: "SA", Sun: "SU" };
  const dates = weekDates();
  const lead = state.reminders.lead || 10;
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//FocusFlow//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:FocusFlow Study"];
  state.sessions.forEach((s) => {
    const di = DAYS.indexOf(s.day);
    const dt = dates[di].replace(/-/g, "") + "T" + s.start.replace(":", "") + "00";
    L.push("BEGIN:VEVENT", "UID:" + s.id + "@focusflow", "DTSTART:" + dt, "DURATION:PT" + s.duration + "M",
      "RRULE:FREQ=WEEKLY;BYDAY=" + BYDAY[s.day], "SUMMARY:" + icsEsc(s.subject) + " (study)",
      "DESCRIPTION:" + icsEsc("FocusFlow study session"),
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEsc(s.subject + " starts soon"),
      "TRIGGER:-PT" + lead + "M", "END:VALARM", "END:VEVENT");
  });
  L.push("END:VCALENDAR");
  return L.join("\r\n");
}
document.getElementById("calBtn").addEventListener("click", () => {
  if (!state.sessions.length) { toast("Add some quests first"); return; }
  const blob = new Blob([buildICS()], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "focusflow.ics"; a.click();
  URL.revokeObjectURL(url);
  toast("📅 Calendar file saved · open it in your calendar app");
});

// ---------- Clock ----------
function tickClock() { document.getElementById("clock").textContent = new Date().toLocaleString(undefined, { weekday: "long", hour: "2-digit", minute: "2-digit" }); }
setInterval(tickClock, 1000); tickClock();

// ---------- D-day countdown tới kỳ thi vào 10 chuyên Lý LHP ----------
// Kỳ thi TPHCM thường đầu tháng 6. Dự kiến ~06/06/2027 (cập nhật khi Sở công bố lịch chính thức).
const EXAM_DATE = new Date("2027-06-06T00:00:00");
function tickDday() {
  const el = document.getElementById("ddayNum");
  if (!el) return;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const days = Math.ceil((EXAM_DATE - now) / 86400000);
  const lbl = document.querySelector(".dday-lbl");
  if (days > 0) { el.textContent = days; if (lbl) lbl.textContent = "ngày tới kỳ thi"; }
  else if (days === 0) { el.textContent = "🔥"; if (lbl) lbl.textContent = "Hôm nay thi, cố lên!"; }
  else { el.textContent = "✓"; if (lbl) lbl.textContent = "Kỳ thi đã qua"; }
}
tickDday(); setInterval(tickDday, 3600000);

// ---------- Helpers ----------
function fmtDur(min) { if (min < 60) return `${min}m`; const h = Math.floor(min / 60), m = min % 60; return m ? `${h}h ${m}m` : `${h}h`; }
function fmtHrs(min) { const h = min / 60; return (Number.isInteger(h) ? h : h.toFixed(1)) + "h"; }
function fmtHrsShort(min) { return min >= 60 ? (min / 60).toFixed(min % 60 ? 1 : 0) + "h" : min + "m"; }
function hexToRgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`; }
function escapeHtml(s) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
let toastTimer = null;
function toast(msg) { const t = document.getElementById("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2400); }

// ---------- Seed demo (first run only) ----------
if (state.sessions.length === 0 && !localStorage.getItem(STORE_KEY)) {
  // Lịch Hè 2026 — các lớp học thêm (Nova set sẵn)
  state.sessions = [
    { id: uid(), subject: "Lớp Code",     day: "Mon", start: "20:00", duration: 60,  color: COLORS[4] },
    { id: uid(), subject: "Lớp Toán",     day: "Tue", start: "08:30", duration: 120, color: COLORS[3] },
    { id: uid(), subject: "Lớp Anh",      day: "Wed", start: "09:30", duration: 120, color: COLORS[0] },
    { id: uid(), subject: "Lớp Anh",      day: "Thu", start: "17:45", duration: 195, color: COLORS[0] },
    { id: uid(), subject: "Tiếng Trung",  day: "Sat", start: "10:30", duration: 90,  color: COLORS[5] },
    { id: uid(), subject: "Lớp Toán",     day: "Sat", start: "13:30", duration: 120, color: COLORS[3] },
    { id: uid(), subject: "⚡ Chuyên Lý",  day: "Sat", start: "17:30", duration: 210, color: COLORS[2] },
    { id: uid(), subject: "Tiếng Trung",  day: "Sun", start: "10:30", duration: 90,  color: COLORS[5] },
  ];
}

document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });

// ---------- PWA ----------
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
let deferredPrompt = null;
const installBtn = document.getElementById("installBtn");
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone;
if (!isStandalone()) installBtn.hidden = false; // always offer install (with instructions fallback)

function openInfo(title, html) {
  const back = document.createElement("div");
  back.className = "modal-backdrop";
  back.innerHTML = `<div class="modal card"><h2 class="card-title">${title}</h2><div class="info-body">${html}</div><div class="modal-actions"><button class="btn primary">Got it</button></div></div>`;
  document.body.appendChild(back);
  const close = () => back.remove();
  back.addEventListener("click", (e) => { if (e.target === back) close(); });
  back.querySelector("button").addEventListener("click", close);
}
function showInstallHelp() {
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (/mac/i.test(ua) && "ontouchend" in document);
  const android = /android/i.test(ua);
  let html;
  if (ios) html = "On iPhone / iPad (use <b>Safari</b>):<br>1. Tap the <b>Share</b> button ⬆️<br>2. Scroll to <b>Add to Home Screen</b><br>3. Tap <b>Add</b> · done! 🎉";
  else if (android) html = "On Android (use <b>Chrome</b>):<br>Tap the menu <b>⋮</b> → <b>Add to Home screen</b> → <b>Install</b>.";
  else html = "On desktop <b>Chrome / Edge</b>:<br>Click the <b>install icon ⊕</b> in the address bar,<br>or menu <b>⋮ → Install FocusFlow</b>.";
  openInfo("📲 Install FocusFlow", html);
}
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; if (!isStandalone()) installBtn.hidden = false; });
installBtn.addEventListener("click", async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") toast("Installing FocusFlow… 🎉");
    deferredPrompt = null;
  } else {
    showInstallHelp();
  }
});
window.addEventListener("appinstalled", () => { installBtn.hidden = true; toast("FocusFlow installed ✓"); });

paintTimer();
syncReminderUI();
render();

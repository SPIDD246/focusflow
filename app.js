// ---------- FocusFlow: learning & schedule manager ----------
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const COLORS = ["#7c5cff", "#22d3ee", "#34d399", "#fbbf24", "#f472b6", "#f87171"];
const WEEKLY_GOAL_H = 10;
const STORE_KEY = "focusflow.v1";

// ---------- State ----------
let state = load();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    if (raw && raw.sessions) {
      if (!raw.reminders) raw.reminders = { enabled: false, lead: 10 };
      return raw;
    }
  } catch (_) {}
  return { sessions: [], focusMinutes: 0, focusLog: [], reminders: { enabled: false, lead: 10 } };
}
function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

const uid = () => Math.random().toString(36).slice(2, 9);
const todayIdx = () => (new Date().getDay() + 6) % 7; // Mon=0

// ---------- Rendering ----------
const weekEl = document.getElementById("week");

function render() {
  weekEl.innerHTML = "";
  DAYS.forEach((day, i) => {
    const col = document.createElement("div");
    col.className = "day-col" + (i === todayIdx() ? " today" : "");

    const head = document.createElement("div");
    head.className = "day-head";
    head.innerHTML = `<span>${day}</span>${i === todayIdx() ? '<span class="dot"></span>' : ""}`;
    col.appendChild(head);

    const daySessions = state.sessions
      .filter((s) => s.day === day)
      .sort((a, b) => a.start.localeCompare(b.start));

    if (daySessions.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-day";
      empty.textContent = "No sessions";
      col.appendChild(empty);
    }

    daySessions.forEach((s) => col.appendChild(sessionEl(s)));
    weekEl.appendChild(col);
  });
  renderStats();
  save();
}

function sessionEl(s) {
  const el = document.createElement("div");
  el.className = "session";
  el.style.background = hexToRgba(s.color, 0.12);
  el.innerHTML = `
    <span class="s-bar" style="background:${s.color}"></span>
    <button class="s-del" title="Delete">&times;</button>
    <div class="s-subj">${escapeHtml(s.subject)}</div>
    <div class="s-time">${s.start} · ${fmtDur(s.duration)}</div>`;
  el.querySelector(".s-del").addEventListener("click", (e) => {
    e.stopPropagation();
    state.sessions = state.sessions.filter((x) => x.id !== s.id);
    render();
    toast("Session removed");
  });
  el.addEventListener("click", () => openModal(s));
  return el;
}

function renderStats() {
  const count = state.sessions.length;
  const plannedMin = state.sessions.reduce((a, s) => a + s.duration, 0);
  document.getElementById("statSessions").textContent = count;
  document.getElementById("statHours").textContent = fmtHrs(plannedMin);
  document.getElementById("statFocus").textContent = fmtHrs(state.focusMinutes);
  document.getElementById("statStreak").textContent = streak();

  const focusH = state.focusMinutes / 60;
  const pct = Math.min(100, (focusH / WEEKLY_GOAL_H) * 100);
  document.getElementById("goalFill").style.width = pct + "%";
  document.getElementById("goalText").textContent = `${focusH.toFixed(1)} / ${WEEKLY_GOAL_H}h`;
}

function streak() {
  if (!state.focusLog.length) return 0;
  const days = new Set(state.focusLog);
  let n = 0;
  const d = new Date();
  while (days.has(isoDay(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
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
  sw.addEventListener("click", () => {
    pickedColor = c;
    [...swatchWrap.children].forEach((x) => x.classList.remove("sel"));
    sw.classList.add("sel");
  });
  swatchWrap.appendChild(sw);
});

function openModal(session = null) {
  editingId = session ? session.id : null;
  document.getElementById("modalTitle").textContent = session ? "Edit session" : "New session";
  document.getElementById("saveBtn").textContent = session ? "Save changes" : "Add session";
  if (session) {
    form.subject.value = session.subject;
    form.day.value = session.day;
    form.start.value = session.start;
    form.duration.value = session.duration;
    pickedColor = session.color;
  } else {
    form.reset();
    form.day.value = DAYS[todayIdx()];
    pickedColor = COLORS[0];
  }
  [...swatchWrap.children].forEach((x, i) =>
    x.classList.toggle("sel", COLORS[i] === pickedColor)
  );
  modal.hidden = false;
}
function closeModal() { modal.hidden = true; editingId = null; }

document.getElementById("openAdd").addEventListener("click", () => openModal());
document.getElementById("cancelBtn").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = {
    subject: form.subject.value.trim(),
    day: form.day.value,
    start: form.start.value,
    duration: parseInt(form.duration.value, 10),
    color: pickedColor,
  };
  if (!data.subject) return;
  if (editingId) {
    const s = state.sessions.find((x) => x.id === editingId);
    Object.assign(s, data);
    toast("Session updated");
  } else {
    state.sessions.push({ id: uid(), ...data });
    toast("Session added");
  }
  closeModal();
  render();
});

// ---------- Focus timer ----------
const ring = document.getElementById("ringFg");
const RING_LEN = 2 * Math.PI * 52;
ring.style.strokeDasharray = RING_LEN;
const display = document.getElementById("timerDisplay");
const toggleBtn = document.getElementById("timerToggle");

let totalSec = 25 * 60;
let remaining = totalSec;
let running = false;
let tick = null;

function paintTimer() {
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  display.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  const frac = remaining / totalSec;
  ring.style.strokeDashoffset = RING_LEN * (1 - frac);
}

function startTimer() {
  running = true;
  toggleBtn.textContent = "Pause";
  tick = setInterval(() => {
    remaining--;
    paintTimer();
    if (remaining <= 0) finishTimer();
  }, 1000);
}
function pauseTimer() {
  running = false;
  toggleBtn.textContent = "Start";
  clearInterval(tick);
}
function finishTimer() {
  clearInterval(tick);
  running = false;
  toggleBtn.textContent = "Start";
  const mins = Math.round(totalSec / 60);
  state.focusMinutes += mins;
  const day = isoDay(new Date());
  if (!state.focusLog.includes(day)) state.focusLog.push(day);
  save();
  renderStats();
  remaining = totalSec;
  paintTimer();
  toast(`Nice! +${mins} min of focus logged 🎉`);
  try { new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==").play(); } catch (_) {}
}

toggleBtn.addEventListener("click", () => (running ? pauseTimer() : startTimer()));
document.getElementById("timerReset").addEventListener("click", () => {
  pauseTimer();
  remaining = totalSec;
  paintTimer();
});
document.querySelectorAll(".timer-presets .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".timer-presets .chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    totalSec = parseInt(chip.dataset.min, 10) * 60;
    remaining = totalSec;
    pauseTimer();
    paintTimer();
  });
});

// ---------- Reminders ----------
const remToggle = document.getElementById("remToggle");
const remLead = document.getElementById("remLead");
const remHint = document.getElementById("remHint");
const leadRow = document.getElementById("leadRow");
const notified = new Set(); // session-day keys already fired this page session

function syncReminderUI() {
  const on = state.reminders.enabled;
  remToggle.checked = on;
  remLead.value = String(state.reminders.lead);
  leadRow.style.display = on ? "flex" : "none";
  remHint.textContent = on
    ? `On — pings ${state.reminders.lead} min before each class`
    : "Off — get a ping before class";
}

remToggle.addEventListener("change", async () => {
  if (remToggle.checked) {
    if (!("Notification" in window)) {
      toast("This browser doesn't support notifications");
      remToggle.checked = false;
      return;
    }
    let perm = Notification.permission;
    if (perm !== "granted") perm = await Notification.requestPermission();
    if (perm !== "granted") {
      toast("Allow notifications to enable reminders");
      remToggle.checked = false;
      return;
    }
    state.reminders.enabled = true;
    toast("Reminders on 🔔 (keep this tab open)");
  } else {
    state.reminders.enabled = false;
    toast("Reminders off");
  }
  save();
  syncReminderUI();
});

remLead.addEventListener("change", () => {
  state.reminders.lead = parseInt(remLead.value, 10);
  save();
  syncReminderUI();
});

function checkReminders() {
  if (!state.reminders.enabled || Notification.permission !== "granted") return;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const today = DAYS[todayIdx()];
  const key = isoDay(now);
  state.sessions.forEach((s) => {
    if (s.day !== today) return;
    const [h, m] = s.start.split(":").map(Number);
    const fireAt = h * 60 + m - state.reminders.lead;
    if (nowMin === fireAt) {
      const k = `${s.id}-${key}`;
      if (notified.has(k)) return;
      notified.add(k);
      try {
        new Notification("📚 " + s.subject, {
          body: `Starts at ${s.start} · ${fmtDur(s.duration)} — in ${state.reminders.lead} min`,
          silent: false,
        });
      } catch (_) {}
      toast(`🔔 ${s.subject} starts in ${state.reminders.lead} min`);
    }
  });
}
setInterval(checkReminders, 20000);

// ---------- Export / Import ----------
document.getElementById("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "focusflow-schedule.json";
  a.click();
  URL.revokeObjectURL(url);
  toast("Schedule exported ⭳");
});

const importFile = document.getElementById("importFile");
document.getElementById("importBtn").addEventListener("click", () => importFile.click());
importFile.addEventListener("change", () => {
  const file = importFile.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.sessions)) throw new Error("bad file");
      state.sessions = data.sessions;
      state.focusMinutes = data.focusMinutes || 0;
      state.focusLog = Array.isArray(data.focusLog) ? data.focusLog : [];
      state.reminders = data.reminders || { enabled: false, lead: 10 };
      save();
      render();
      syncReminderUI();
      toast(`Imported ${state.sessions.length} sessions ✓`);
    } catch (_) {
      toast("Couldn't read that file — invalid format");
    }
    importFile.value = "";
  };
  reader.readAsText(file);
});

// ---------- Clock ----------
function tickClock() {
  const now = new Date();
  const opts = { weekday: "long", hour: "2-digit", minute: "2-digit" };
  document.getElementById("clock").textContent = now.toLocaleString(undefined, opts);
}
setInterval(tickClock, 1000);
tickClock();

// ---------- Helpers ----------
function fmtDur(min) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
function fmtHrs(min) {
  const h = min / 60;
  return (Number.isInteger(h) ? h : h.toFixed(1)) + "h";
}
function isoDay(d) { return d.toISOString().slice(0, 10); }
function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
let toastTimer = null;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2400);
}

// ---------- Seed demo data on first run ----------
if (state.sessions.length === 0 && !localStorage.getItem(STORE_KEY)) {
  state.sessions = [
    { id: uid(), subject: "Calculus", day: "Mon", start: "18:00", duration: 60, color: COLORS[0] },
    { id: uid(), subject: "Spanish", day: "Wed", start: "19:30", duration: 45, color: COLORS[1] },
    { id: uid(), subject: "Reading", day: "Sat", start: "10:00", duration: 90, color: COLORS[2] },
  ];
}

// Keyboard: Esc closes modal
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });

// ---------- PWA: install + offline ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
let deferredPrompt = null;
const installBtn = document.getElementById("installBtn");
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});
installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === "accepted") toast("Installing FocusFlow… 🎉");
  deferredPrompt = null;
  installBtn.hidden = true;
});
window.addEventListener("appinstalled", () => {
  installBtn.hidden = true;
  toast("FocusFlow installed ✓");
});

paintTimer();
syncReminderUI();
render();

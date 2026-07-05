// ---------- FocusFlow ----------
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const COLORS = ["#6fae7c", "#3f9d7f", "#e6b25f", "#6aa7c4", "#b490d4", "#ef7d5d"];
const WEEKLY_GOAL_H = 10;
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
      e.className = "empty-day"; e.textContent = "No sessions";
      col.appendChild(e);
    }
    list.forEach((s) => col.appendChild(sessionEl(s, !!done[s.id])));
    weekEl.appendChild(col);
  });
  renderStats();
  renderChart();
  renderSubjects();
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
    render(); toast("Session removed");
  });
  el.querySelector(".s-check").addEventListener("click", (e) => {
    e.stopPropagation();
    const dm = doneMap();
    if (dm[s.id]) { delete dm[s.id]; }
    else { dm[s.id] = true; burst(e.clientX, e.clientY); toast(`✓ ${s.subject} done — nice work!`); }
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
}

function streak() {
  const days = new Set(state.focusLog);
  let n = 0; const d = new Date();
  while (days.has(isoDay(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
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

// ---- Time by subject ----
function renderSubjects() {
  const box = document.getElementById("subjectList");
  const map = {};
  state.sessions.forEach((s) => {
    map[s.subject] ||= { min: 0, color: s.color };
    map[s.subject].min += s.duration;
  });
  const rows = Object.entries(map).sort((a, b) => b[1].min - a[1].min);
  if (!rows.length) { box.innerHTML = `<div class="insights-empty">Add sessions to see your subjects.</div>`; return; }
  const max = Math.max(...rows.map((r) => r[1].min));
  box.innerHTML = rows.map(([name, v]) => `
    <div class="subj-row">
      <div class="subj-top"><span>${escapeHtml(name)}</span><span class="subj-time">${fmtDur(v.min)}/wk</span></div>
      <div class="subj-bar-track"><div class="subj-bar" style="width:${(v.min / max) * 100}%;background:${v.color}"></div></div>
    </div>`).join("");
}

// ---- Badges ----
function renderBadges() {
  const st = streak();
  const totalH = state.focusMinutes / 60;
  const dm = doneMap();
  const allDone = state.sessions.length > 0 && state.sessions.every((s) => dm[s.id]);
  const badges = [
    { ico: "🔥", label: "3-day", sub: "streak", earned: st >= 3 },
    { ico: "⚡", label: "7-day", sub: "streak", earned: st >= 7 },
    { ico: "🌙", label: "14-day", sub: "streak", earned: st >= 14 },
    { ico: "🏆", label: "30-day", sub: "streak", earned: st >= 30 },
    { ico: "⏱️", label: "10 hours", sub: "focused", earned: totalH >= 10 },
    { ico: "🌟", label: "50 hours", sub: "focused", earned: totalH >= 50 },
    { ico: "💯", label: "100 hours", sub: "focused", earned: totalH >= 100 },
    { ico: "✅", label: "Perfect week", sub: "all done", earned: allDone },
  ];
  document.getElementById("badges").innerHTML = badges.map((b) => `
    <div class="badge ${b.earned ? "earned" : "locked"}">
      <div class="badge-ico">${b.ico}</div>
      <div class="badge-num">${b.label}</div>
      <div class="badge-sub">${b.sub}</div>
    </div>`).join("");
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
  document.getElementById("modalTitle").textContent = session ? "Edit session" : "New session";
  document.getElementById("saveBtn").textContent = session ? "Save changes" : "Add session";
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
  if (editingId) { Object.assign(state.sessions.find((x) => x.id === editingId), data); toast("Session updated"); }
  else { state.sessions.push({ id: uid(), ...data }); toast("Session added"); }
  closeModal(); render();
});

// ---------- Focus timer ----------
const ring = document.getElementById("ringFg");
const RING_LEN = 2 * Math.PI * 52;
ring.style.strokeDasharray = RING_LEN;
const display = document.getElementById("timerDisplay");
const toggleBtn = document.getElementById("timerToggle");
let totalSec = 25 * 60, remaining = totalSec, running = false, tick = null;

function paintTimer() {
  const m = Math.floor(remaining / 60), s = remaining % 60;
  display.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  ring.style.strokeDashoffset = RING_LEN * (1 - remaining / totalSec);
}
function startTimer() {
  running = true; toggleBtn.textContent = "Pause";
  if (soundWithTimer && soundWithTimer.checked && activeSound === "off") setSound("lofi");
  tick = setInterval(() => { remaining--; paintTimer(); if (remaining <= 0) finishTimer(); }, 1000);
}
function pauseTimer() { running = false; toggleBtn.textContent = "Start"; clearInterval(tick); }
function finishTimer() {
  clearInterval(tick); running = false; toggleBtn.textContent = "Start";
  if (soundWithTimer && soundWithTimer.checked) setSound("off");
  const mins = Math.round(totalSec / 60);
  const day = isoDay(new Date());
  state.focusMinutes += mins;
  state.focusByDay[day] = (state.focusByDay[day] || 0) + mins;
  if (!state.focusLog.includes(day)) state.focusLog.push(day);
  save(); render();
  remaining = totalSec; paintTimer();
  burst(window.innerWidth / 2, window.innerHeight / 2);
  toast(`Nice! +${mins} min of focus logged 🎉`);
  notify("⏱️ Focus complete!", `You focused for ${mins} minutes. Keep it up!`);
}
toggleBtn.addEventListener("click", () => (running ? pauseTimer() : startTimer()));
document.getElementById("timerReset").addEventListener("click", () => { pauseTimer(); remaining = totalSec; paintTimer(); });
document.querySelectorAll(".timer-presets .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".timer-presets .chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    totalSec = parseInt(chip.dataset.min, 10) * 60; remaining = totalSec; pauseTimer(); paintTimer();
  });
});

// ---------- Theme ----------
const themeMeta = document.getElementById("themeColorMeta");
const themeToggle = document.getElementById("themeToggle");
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  themeToggle.textContent = t === "dark" ? "☀️" : "🌙";
  themeMeta.content = t === "dark" ? "#0f150d" : "#eef4e8";
}
(function initTheme() {
  const t = state.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
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
  remHint.textContent = on ? `On — pings ${state.reminders.lead} min before each class` : "Off — get a ping before class";
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
      notify("📚 " + s.subject, `Starts at ${s.start} · ${fmtDur(s.duration)} — in ${state.reminders.lead} min`);
      toast(`🔔 ${s.subject} in ${state.reminders.lead} min`);
    }
  });
  if (state.reminders.summary && nowMin === 20 * 60) {
    const k = "summary-" + key;
    if (!notified.has(k)) { notified.add(k);
      const mins = state.focusByDay[key] || 0;
      notify("🌙 Daily summary", mins ? `Today you focused for ${fmtHrs(mins)}. Great job!` : "No focus logged today — a short 15-min session still counts!");
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
      toast(`Imported ${state.sessions.length} sessions ✓`);
    } catch (_) { toast("Couldn't read that file — invalid format"); }
    importFile.value = "";
  };
  reader.readAsText(file);
});

// ---------- Focus sounds (Web Audio, generated live — no files, works offline) ----------
let AC = null, master = null, activeSound = "off", stopFns = [], vol = 0.55;
function audio() {
  if (!AC) {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = vol; master.connect(AC.destination);
  }
  if (AC.state === "suspended") AC.resume();
  return AC;
}
function stopSound() { stopFns.forEach((f) => { try { f(); } catch (_) {} }); stopFns = []; }
function noiseBuffer(type) {
  const len = 2 * AC.sampleRate, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (type === "brown") { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  return buf;
}
function noiseSource(type, filters, gain, swell) {
  const ctx = audio(), src = ctx.createBufferSource();
  src.buffer = noiseBuffer(type); src.loop = true;
  let node = src;
  filters.forEach((f) => { const b = ctx.createBiquadFilter(); b.type = f.type; b.frequency.value = f.freq; node.connect(b); node = b; });
  const g = ctx.createGain(); g.gain.value = gain; node.connect(g); g.connect(master); src.start();
  stopFns.push(() => { try { src.stop(); } catch (_) {} });
  if (swell) { // slow wave-like amplitude LFO
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = swell.rate; lg.gain.value = swell.depth;
    lfo.connect(lg); lg.connect(g.gain); lfo.start();
    stopFns.push(() => { try { lfo.stop(); } catch (_) {} });
  }
}
function playRain() { noiseSource("white", [{ type: "highpass", freq: 420 }, { type: "lowpass", freq: 3400 }], 0.5, { rate: 0.15, depth: 0.12 }); }
function playOcean() { noiseSource("brown", [{ type: "lowpass", freq: 700 }], 0.85, { rate: 0.08, depth: 0.35 }); }
function playLofi() {
  noiseSource("brown", [{ type: "lowpass", freq: 500 }], 0.14); // warm pad underneath
  const ctx = audio(), scale = [0, 3, 5, 7, 10], root = 220;
  const step = () => {
    const n = scale[(Math.random() * scale.length) | 0] + (Math.random() < 0.4 ? 12 : 0);
    note(root * Math.pow(2, n / 12));
    if (Math.random() < 0.5) note(root * Math.pow(2, (n + 7) / 12), 0.14);
  };
  const t = setInterval(step, 1600); step();
  stopFns.push(() => clearInterval(t));
}
function note(freq, peak = 0.22) {
  const ctx = audio(), o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
  o.type = "triangle"; o.frequency.value = freq; lp.type = "lowpass"; lp.frequency.value = 1600;
  o.connect(lp); lp.connect(g); g.connect(master);
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.06); g.gain.exponentialRampToValueAtTime(0.001, t + 1.9);
  o.start(t); o.stop(t + 2);
}
function setSound(s) {
  stopSound(); activeSound = s;
  document.querySelectorAll(".sound-btn").forEach((b) => b.classList.toggle("active", b.dataset.sound === s));
  if (s === "off") return;
  audio();
  ({ rain: playRain, ocean: playOcean, lofi: playLofi }[s] || (() => {}))();
}
document.querySelectorAll(".sound-btn").forEach((btn) => btn.addEventListener("click", () => {
  const s = btn.dataset.sound; setSound(s);
  toast(s === "off" ? "Sound off" : "Playing " + btn.textContent.trim());
}));
document.getElementById("vol").addEventListener("input", (e) => { vol = e.target.value / 100; if (master) master.gain.value = vol; });
const soundWithTimer = document.getElementById("soundWithTimer");

// ---------- Add to phone calendar (.ics — native reminders even when app closed) ----------
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
  if (!state.sessions.length) { toast("Add some sessions first"); return; }
  const blob = new Blob([buildICS()], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "focusflow.ics"; a.click();
  URL.revokeObjectURL(url);
  toast("📅 Calendar file saved — open it in your calendar app");
});

// ---------- Clock ----------
function tickClock() { document.getElementById("clock").textContent = new Date().toLocaleString(undefined, { weekday: "long", hour: "2-digit", minute: "2-digit" }); }
setInterval(tickClock, 1000); tickClock();

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
  state.sessions = [
    { id: uid(), subject: "Calculus", day: "Mon", start: "18:00", duration: 60, color: COLORS[0] },
    { id: uid(), subject: "Spanish", day: "Wed", start: "19:30", duration: 45, color: COLORS[1] },
    { id: uid(), subject: "Reading", day: "Sat", start: "10:00", duration: 90, color: COLORS[2] },
  ];
}

document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });

// ---------- PWA ----------
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
let deferredPrompt = null;
const installBtn = document.getElementById("installBtn");
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; installBtn.hidden = false; });
installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice;
  if (outcome === "accepted") toast("Installing FocusFlow… 🎉");
  deferredPrompt = null; installBtn.hidden = true;
});
window.addEventListener("appinstalled", () => { installBtn.hidden = true; toast("FocusFlow installed ✓"); });

paintTimer();
syncReminderUI();
render();

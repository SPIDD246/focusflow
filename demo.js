// demo.js — FocusFlow DEMO MODE
// Bật bằng ?demo (vd: index.html?demo=1). Mục đích: cho người khác xem thử mọi tính năng
// mà KHÔNG đụng tới dữ liệu thật và KHÔNG ghi gì lên cloud.
//
// Cách hoạt động:
//   1. Nạp TRƯỚC app.js → app.js đọc window.FF_DEMO để chọn STORE_KEY riêng ("focusflow.demo").
//      → Dữ liệu thật ở "focusflow.v1" không bao giờ bị đọc/ghi trong demo.
//   2. index.html KHÔNG nạp firebase-sync.js khi ở demo → không login, không đọc/ghi Firestore.
//   3. Seed sẵn một nhân vật đã chơi lâu (level, streak, lịch, quest) — mốc thời gian tính
//      theo NGÀY HÔM NAY nên demo luôn "sống", không bao giờ cũ.
//   4. Banner + tour có hướng dẫn từng tính năng.
(function () {
  const DEMO = /(^|[?&])demo\b/.test(location.search) || /(^|[#&])demo\b/.test(location.hash);
  window.FF_DEMO = DEMO;
  window.FF_DEMO_KEY = "focusflow.demo";
  if (!DEMO) return;

  const KEY = window.FF_DEMO_KEY;
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // ---- Date helpers (giống hệt app.js để state khớp tuyệt đối) ----
  const isoDay = (dt) => {
    const d = new Date(dt);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  };
  const todayIdx = () => (new Date().getDay() + 6) % 7; // Mon=0
  const mondayDate = () => { const n = new Date(); n.setHours(0, 0, 0, 0); n.setDate(n.getDate() - todayIdx()); return n; };
  const weekKey = () => isoDay(mondayDate());
  const daysAgo = (n) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return isoDay(d); };

  // Boss của tuần: HP lấy theo đúng thuật toán hash trong app.js (BOSSES cùng thứ tự).
  // Cần biết HP để seed số phút vừa đủ → boss còn sống, thanh máu đẹp, không nổ popup "BOSS DEFEATED".
  const BOSS_HP = [120, 180, 210, 240, 300];
  function bossHp(wk) {
    let h = 0;
    for (let i = 0; i < wk.length; i++) h = (h * 31 + wk.charCodeAt(i)) | 0;
    return BOSS_HP[Math.abs(h) % BOSS_HP.length];
  }

  // ---- Hồ sơ demo ----
  function buildDemoState() {
    const today = isoDay(new Date());
    const wk = weekKey();
    const ti = todayIdx();

    const sessions = [
      { id: "d1",  subject: "Mathematics",   day: "Mon", start: "07:30", duration: 90,  color: "#6aa7c4" },
      { id: "d2",  subject: "Coding",        day: "Mon", start: "19:30", duration: 60,  color: "#b490d4" },
      { id: "d3",  subject: "Physics",       day: "Tue", start: "08:30", duration: 90,  color: "#3f9d7f" },
      { id: "d4",  subject: "Reading",       day: "Tue", start: "20:00", duration: 45,  color: "#6fae7c" },
      { id: "d5",  subject: "English",       day: "Wed", start: "09:30", duration: 120, color: "#6fae7c" },
      { id: "d6",  subject: "Mathematics",   day: "Thu", start: "17:45", duration: 90,  color: "#6aa7c4" },
      { id: "d7",  subject: "Coding",        day: "Thu", start: "20:00", duration: 60,  color: "#b490d4" },
      { id: "d8",  subject: "Chemistry",     day: "Fri", start: "08:00", duration: 90,  color: "#e6b25f" },
      { id: "d9",  subject: "Language",      day: "Sat", start: "10:30", duration: 90,  color: "#ef7d5d" },
      { id: "d10", subject: "Side Project",  day: "Sat", start: "14:00", duration: 120, color: "#e6b25f" },
      { id: "d11", subject: "Weekly Review", day: "Sun", start: "10:00", duration: 60,  color: "#3f9d7f" },
      { id: "d12", subject: "Deep Work",     day: "Sun", start: "16:00", duration: 60,  color: "#b490d4" },
    ];

    // Đánh dấu hoàn thành: mọi buổi của ngày ĐÃ QUA trong tuần + buổi HÔM NAY đã tới giờ kết thúc.
    // (Nhờ vế sau, demo mở vào thứ Hai vẫn có buổi được tick, không trống trơn.)
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const endMin = (s) => { const [h, m] = s.start.split(":").map(Number); return h * 60 + m + s.duration; };
    const done = {};
    sessions.forEach((s) => {
      const di = DAYS.indexOf(s.day);
      if (di < ti || (di === ti && endMin(s) <= nowMin)) done[s.id] = true;
    });

    // Số phút học từng ngày trong tuần này — số thật của một người học đều: biểu đồ có cao có thấp.
    const WEEK_MIN = [110, 85, 130, 65, 125, 95, 105];   // Mon..Sun
    const focusByDay = {};
    const focusLog = [];
    for (let i = 0; i < ti; i++) {                        // completed days
      const date = daysAgo(ti - i);
      focusByDay[date] = WEEK_MIN[i];
      focusLog.push(date);
    }
    // Hôm nay mới đi được nửa chặng: 91 phút → mục tiêu ngày ~76% (đang dở, đẹp hơn là đầy),
    // và đủ cho các quest phút → nút CLAIM sáng sẵn cho người xem bấm thử.
    focusByDay[today] = 91;
    focusLog.push(today);

    // Tổng phút học trong tuần này = sát thương đã gây cho boss (app.js cộng đúng các ngày Mon..Sun).
    const weekDamage = WEEK_MIN.slice(0, ti).reduce((a, b) => a + b, 0) + focusByDay[today];

    // Chuỗi ngày học kéo dài sang TUẦN TRƯỚC → streak dài, nhưng không cộng sát thương boss tuần này
    // (boss chỉ tính các ngày trong tuần hiện tại).
    const prev = [95, 130, 70, 145, 110, 60, 125];
    for (let i = 0; i < prev.length; i++) {
      const date = daysAgo(ti + 1 + i);   // continue backward from the day before this week's Monday
      focusByDay[date] = prev[i];
      focusLog.push(date);
    }

    // XP tích lũy → Level 12 ("Scholar"): mở khoá 3 skill, skill kế tiếp còn 2 LV.
    // Đường cong trong app.js: xpToNext(lv) = floor(15 * lv^1.7) → cộng dồn tới Lv12 ≈ 4049 XP.
    const XP = 4460;

    return {
      sessions,
      completions: { [wk]: done },
      focusByDay,
      focusLog,
      focusMinutes: XP,                 // 1 XP = 1 study minute (same convention as app.js)
      theme: "dark",
      reminders: { enabled: true, lead: 10, summary: false },
      rpg: {
        xp: XP,
        stats: { int: 2100, dis: 1450, foc: XP, str: 620 },
        seeded: true,                   // do not backfill XP from focusMinutes again
        train: "int",
        totalSessions: 63,
        questsClaimed: 41,
        bossesDefeated: 3,
        // perksSeen/achSeen bỏ trống → app.js tự backfill IM LẶNG (không spam popup mở khoá).
        sysMsgDay: isoDay(new Date()),  // skip the 【SYSTEM】 panel so it does not cover the tour
      },
      quests: { day: isoDay(new Date()), sessions: 2, claimed: {} }, // picks auto-generate; s2 is claimable immediately
      // Sát thương boss = tổng phút học TRONG TUẦN. Tự tính xem boss đã chết chưa rồi ghi đúng cờ:
      // đầu tuần boss còn sống (hiện thanh máu), cuối tuần boss đã bị hạ (hiện thẻ SLAIN + phần thưởng).
      // Ghi sẵn cờ `defeated` để app.js KHÔNG bắn lại popup "BOSS DEFEATED" mỗi lần mở demo.
      boss: { week: wk, defeated: weekDamage >= bossHp(wk) },
      demoDay: today,                   // marker used to refresh demo daily
      updatedAt: Date.now(),
    };
  }

  function seed() { localStorage.setItem(KEY, JSON.stringify(buildDemoState())); }

  // Seed lần đầu; và seed lại nếu bản demo cũ từ ngày khác (để streak/quest/biểu đồ luôn tươi).
  try {
    const cur = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!cur || cur.demoDay !== isoDay(new Date())) seed();
  } catch (_) { seed(); }

  window.FF_DEMO_RESET = () => { seed(); location.reload(); };

  // ---------------- Giao diện demo: banner + tour ----------------

  // Ẩn các panel phụ trong demo → view gọn, chỉ còn tính năng cốt lõi.
  // (Muốn hiện/ẩn thêm panel nào thì sửa danh sách này.)
  function hidePanels() {
    document.querySelectorAll(".boss-card, .reminders-card").forEach((el) => { el.style.display = "none"; });
    ["perkTree", "soundGrid"].forEach((id) => {
      const card = document.getElementById(id) && document.getElementById(id).closest(".card");
      if (card) card.style.display = "none";
    });
  }

  // DEMO LOGIN GATE: account-style login screen for demo mode.
  // Safety: this is NOT Google, does NOT use Google branding, and never stores/sends passwords.
  function setupFakeLogin() {
    const AUTH_KEY = "ff_demo_auth";
    const USER_KEY = "ff_demo_user";
    const say = (text, kind, user) => {
      if (window.FF && window.FF.onSyncStatus) window.FF.onSyncStatus(text, kind, user);
      const out = document.getElementById("demoLogoutBtn");
      if (out) out.hidden = kind !== "signed-in";
    };
    const isAuthed = () => sessionStorage.getItem(AUTH_KEY) === "1";
    const savedUser = () => {
      try { return JSON.parse(sessionStorage.getItem(USER_KEY) || "null"); }
      catch (_) { return null; }
    };

    function ensureLogoutButton() {
      if (document.getElementById("demoLogoutBtn")) return;
      const syncBtn = document.getElementById("syncBtn");
      if (!syncBtn || !syncBtn.parentNode) return;
      const btn = document.createElement("button");
      btn.id = "demoLogoutBtn";
      btn.className = "btn ghost sync-btn";
      btn.hidden = !window.FFSync || !window.FFSync.user;
      btn.textContent = "Log Out";
      btn.title = "Log out of demo account";
      btn.addEventListener("click", () => window.FFSync && window.FFSync.logout());
      syncBtn.insertAdjacentElement("afterend", btn);
    }

    function ensureLoginScreen() {
      if (document.getElementById("ffdLogin")) return;
      const wrap = document.createElement("div");
      wrap.id = "ffdLogin";
      wrap.className = "ffd-login";
      wrap.innerHTML = `
        <form class="ffd-login-card" id="ffdLoginForm" autocomplete="off">
          <div class="ffd-login-mark">⚔️</div>
          <h2>Sign in to continue</h2>
          <label>Email or username</label>
          <input id="ffdLoginEmail" type="text" placeholder="demo@focusflow.app" autocomplete="username" required />
          <label>Password</label>
          <input id="ffdLoginPass" type="password" placeholder="Any demo password" autocomplete="new-password" required />
          <button class="ffd-login-btn" type="submit">Log in</button>
        </form>`;
      document.body.appendChild(wrap);
      wrap.querySelector("#ffdLoginForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const email = wrap.querySelector("#ffdLoginEmail").value.trim() || "demo@focusflow.app";
        const pass = wrap.querySelector("#ffdLoginPass").value;
        if (!pass.trim()) return;
        sessionStorage.setItem(AUTH_KEY, "1");
        sessionStorage.setItem(USER_KEY, JSON.stringify({ displayName: email.split("@")[0] || "Demo User", email }));
        wrap.classList.add("hide");
        setTimeout(() => wrap.remove(), 220);
        const user = savedUser();
        window.FFSync.user = user;
        say(`✓ ${user.displayName}`, "signed-in", user);
        if (window.toast) window.toast("✓ Demo login successful");
      });
    }

    function showLoginScreen() {
      ensureLoginScreen();
      const el = document.getElementById("ffdLogin");
      if (el) el.classList.remove("hide");
      say("Not signed in", "signed-out");
    }

    window.FFSync = {
      user: isAuthed() ? (savedUser() || { displayName: "Demo User", email: "demo@focusflow.app" }) : null,
      login() { showLoginScreen(); },
      logout() {
        this.user = null;
        sessionStorage.removeItem(AUTH_KEY);
        sessionStorage.removeItem(USER_KEY);
        say("Not signed in", "signed-out");
        if (window.toast) window.toast("Logged out of demo");
      },
      scheduleSync() {},
      createPrivateLink() { return Promise.reject(new Error("demo")); },
      get linkMode() { return false; },
    };

    ensureLogoutButton();
    if (window.FFSync.user) say(`✓ ${window.FFSync.user.displayName}`, "signed-in", window.FFSync.user);
    else say("Not signed in", "signed-out");
  }

  // Tour chỉ đi qua các panel CÒN HIỆN trong demo gọn (khớp với hidePanels ở trên).
  const TOUR = [
    { sel: ".hero-card",     title: "Your character",   body: "Every study minute = 1 XP. XP levels you up and grows INT / DIS / FOC / STR on the radar." },
    { sel: "#week",          title: "Weekly quest board", body: "Your weekly schedule. Click “+ New Quest” to add a study session, or click a session to mark it done." },
    { sel: ".timer-card",    title: "Training timer",      body: "Focus timer (25/45/15 min). XP grows while it runs — choose the stat to train in the TRAIN row." },
    { sel: "#questList",     title: "Daily quests", body: "Each day gives 4 new quests. Finish them and press CLAIM for bonus XP — try it now." },
    { sel: ".card.glow",     title: "Weekly journal",       body: "Quests, completed sessions, studied time, and your streak 🔥." },
    { sel: "#barChart",      title: "Focus chart",  body: "Study minutes for each day of the week." },
    { sel: "#syncBtn",       title: "Demo account",  body: "Click to open the demo login screen. This is a safe simulation, no real account needed and no password is saved." },
  ];

  const css = `
  .ffd-login{position:fixed;inset:0;z-index:12000;display:grid;place-items:center;padding:24px;
    background:radial-gradient(circle at 20% 10%,rgba(139,92,246,.24),transparent 30%),
    radial-gradient(circle at 80% 0,rgba(79,214,255,.18),transparent 32%),rgba(8,8,15,.92);
    backdrop-filter:blur(12px);font-family:Nunito,system-ui,sans-serif;transition:opacity .22s ease,transform .22s ease}
  .ffd-login.hide{opacity:0;transform:scale(.985);pointer-events:none}
  .ffd-login-card{width:min(410px,100%);padding:28px;border-radius:24px;background:#fff;color:#1f2937;
    border:1px solid rgba(148,163,184,.35);box-shadow:0 24px 90px rgba(0,0,0,.45);display:flex;flex-direction:column;gap:10px}
  .ffd-login-mark{width:48px;height:48px;border-radius:16px;display:grid;place-items:center;font-size:24px;
    background:linear-gradient(135deg,#8b5cf6,#4fd6ff);box-shadow:0 10px 28px rgba(139,92,246,.3)}
  .ffd-login-card h2{margin:0;font-size:26px;line-height:1.15;color:#111827;font-weight:900}
  .ffd-login-card label{margin-top:8px;font-size:13px;font-weight:800;color:#374151}
  .ffd-login-card input{height:46px;border-radius:12px;border:1px solid #d1d5db;padding:0 13px;font:inherit;font-size:15px;outline:none;background:#fff;color:#111827}
  .ffd-login-card input:focus{border-color:#8b5cf6;box-shadow:0 0 0 4px rgba(139,92,246,.14)}
  .ffd-login-btn{margin-top:12px;height:46px;border:0;border-radius:999px;background:#1a73e8;color:#fff;font:inherit;font-weight:900;cursor:pointer;box-shadow:0 8px 24px rgba(26,115,232,.28)}
  .ffd-login-btn:hover{background:#1765cc}

  .ffd-bar{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:9000;
    display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:999px;
    background:rgba(18,18,28,.92);border:1px solid rgba(139,92,246,.55);
    box-shadow:0 10px 34px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.05) inset;
    backdrop-filter:blur(10px);font-family:Nunito,system-ui,sans-serif;max-width:calc(100vw - 20px)}
  .ffd-tag{font-family:Orbitron,sans-serif;font-weight:800;font-size:11px;letter-spacing:.12em;
    color:#c4b5fd;background:rgba(139,92,246,.18);border:1px solid rgba(139,92,246,.5);
    padding:4px 9px;border-radius:999px;white-space:nowrap}
  .ffd-txt{color:#cbd5e1;font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ffd-bar button{font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap;
    padding:6px 11px;border-radius:999px;border:1px solid rgba(255,255,255,.16);
    background:rgba(255,255,255,.06);color:#e2e8f0;transition:.15s}
  .ffd-bar button:hover{background:rgba(255,255,255,.14)}
  .ffd-bar button.pri{background:linear-gradient(135deg,#8b5cf6,#4fd6ff);border-color:transparent;color:#0b0b12}
  @media(max-width:640px){.ffd-txt{display:none}}

  .ffd-hole{position:fixed;z-index:9100;border-radius:16px;pointer-events:none;
    box-shadow:0 0 0 9999px rgba(4,4,10,.76),0 0 0 2px #8b5cf6,0 0 26px 4px rgba(139,92,246,.65);
    transition:top .3s cubic-bezier(.4,0,.2,1),left .3s cubic-bezier(.4,0,.2,1),width .3s,height .3s}
  .ffd-tip{position:fixed;z-index:9200;width:min(330px,calc(100vw - 24px));padding:15px 16px;border-radius:14px;
    background:linear-gradient(160deg,#171728,#101018);border:1px solid rgba(139,92,246,.55);
    box-shadow:0 18px 50px rgba(0,0,0,.6);font-family:Nunito,system-ui,sans-serif;
    transition:top .3s cubic-bezier(.4,0,.2,1),left .3s cubic-bezier(.4,0,.2,1)}
  .ffd-step{font-family:Orbitron,sans-serif;font-size:10px;letter-spacing:.14em;color:#8b5cf6;font-weight:700}
  .ffd-tip h3{margin:5px 0 6px;font-size:16px;color:#f1f5f9;font-weight:800}
  .ffd-tip p{margin:0 0 13px;font-size:13.5px;line-height:1.55;color:#a9b2c4}
  .ffd-nav{display:flex;gap:8px;justify-content:flex-end;align-items:center}
  .ffd-nav .ffd-skip{margin-right:auto;background:none;border:none;color:#7c8496;font-size:12.5px;cursor:pointer;font-weight:600}
  .ffd-nav button{font:inherit;font-size:13px;font-weight:700;cursor:pointer;padding:7px 14px;border-radius:9px;
    border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#e2e8f0}
  .ffd-nav button.pri{background:linear-gradient(135deg,#8b5cf6,#4fd6ff);border-color:transparent;color:#0b0b12}
  @media(prefers-reduced-motion:reduce){.ffd-hole,.ffd-tip{transition:none}}
  `;

  let step = 0, hole = null, tip = null, onResize = null;

  function endTour() {
    window.removeEventListener("resize", onResize);
    window.removeEventListener("scroll", onResize, true);
    hole && hole.remove(); tip && tip.remove();
    hole = tip = null;
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) { if (e.key === "Escape") endTour(); else if (e.key === "ArrowRight") go(step + 1); else if (e.key === "ArrowLeft") go(step - 1); }

  function place() {
    const s = TOUR[step];
    const el = document.querySelector(s.sel);
    if (!el || !hole) return;
    const r = el.getBoundingClientRect();
    const pad = 8;
    hole.style.top = (r.top - pad) + "px";
    hole.style.left = (r.left - pad) + "px";
    hole.style.width = (r.width + pad * 2) + "px";
    hole.style.height = (r.height + pad * 2) + "px";

    // Đặt tooltip: ưu tiên bên phải → trái → dưới → trên, kẹp trong màn hình.
    const tw = tip.offsetWidth, th = tip.offsetHeight, gap = 14;
    let left, top;
    if (r.right + gap + tw < innerWidth - 8) left = r.right + gap;
    else if (r.left - gap - tw > 8) left = r.left - gap - tw;
    else left = Math.min(Math.max(8, r.left), innerWidth - tw - 8);
    top = r.top + r.height / 2 - th / 2;
    if (left === r.right + gap || left === r.left - gap - tw) top = r.top;
    else top = (r.bottom + gap + th < innerHeight - 8) ? r.bottom + gap : r.top - gap - th;
    tip.style.left = Math.min(Math.max(8, left), Math.max(8, innerWidth - tw - 8)) + "px";
    tip.style.top = Math.min(Math.max(8, top), Math.max(8, innerHeight - th - 8)) + "px";
  }

  function go(i) {
    if (i < 0) return;
    if (i >= TOUR.length) { endTour(); return; }
    step = i;
    const s = TOUR[step];
    const el = document.querySelector(s.sel);
    if (!el || el.offsetParent === null) { go(i + 1); return; }   // missing / hidden → skip step

    tip.innerHTML = `
      <div class="ffd-step">STEP ${step + 1} / ${TOUR.length}</div>
      <h3></h3><p></p>
      <div class="ffd-nav">
        <button class="ffd-skip">Skip</button>
        ${step > 0 ? '<button class="ffd-prev">← Back</button>' : ""}
        <button class="pri ffd-next">${step === TOUR.length - 1 ? "Done ✓" : "Next →"}</button>
      </div>`;
    tip.querySelector("h3").textContent = s.title;
    tip.querySelector("p").textContent = s.body;
    tip.querySelector(".ffd-skip").onclick = endTour;
    tip.querySelector(".ffd-next").onclick = () => go(step + 1);
    const prev = tip.querySelector(".ffd-prev");
    if (prev) prev.onclick = () => go(step - 1);

    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setTimeout(place, 380);   // wait for scroll before measuring position
  }

  function startTour() {
    endTour();
    hole = document.createElement("div"); hole.className = "ffd-hole";
    tip = document.createElement("div");  tip.className = "ffd-tip";
    document.body.append(hole, tip);
    onResize = () => place();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    document.addEventListener("keydown", onKey);
    go(0);
  }
  window.FF_DEMO_TOUR = startTour;

  function mount() {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    // Demo: ẩn "Link riêng" (không hợp trong demo), NHƯNG giữ nút Đăng nhập để MÔ PHỎNG tài khoản.
    const linkB = document.getElementById("linkBtn"); if (linkB) linkB.hidden = true;
    setupFakeLogin();

    // Demo GỌN: ẩn các panel phụ để người xem chỉ tập trung vào tính năng cốt lõi.
    // Giữ lại: Nhân vật/XP · Lịch tuần · Training timer · Nhiệm vụ ngày · Weekly journal · Biểu đồ.
    // Ẩn đi:   Cây kỹ năng · Boss tuần · Nhạc tập trung · Nhắc học & dữ liệu.
    hidePanels();

    const bar = document.createElement("div");
    bar.className = "ffd-bar";
    bar.innerHTML = `
      <span class="ffd-tag">DEMO</span>
      <span class="ffd-txt">Sample data · not saved to any account</span>
      <button class="pri ffd-tour">▶ Start tour</button>
      <button class="ffd-reset">↺ Reset</button>
      <button class="ffd-exit">Exit</button>`;
    document.body.appendChild(bar);
    bar.querySelector(".ffd-tour").onclick = startTour;
    bar.querySelector(".ffd-reset").onclick = () => window.FF_DEMO_RESET();
    bar.querySelector(".ffd-exit").onclick = () => { location.href = location.pathname; };

    document.body.style.paddingBottom = "72px";

    // Lần đầu vào trong phiên này → tự chạy tour (đợi hiệu ứng khởi động của app xong).
    try {
      if (!sessionStorage.getItem("ff_demo_toured")) {
        sessionStorage.setItem("ff_demo_toured", "1");
        setTimeout(startTour, 1100);
      }
    } catch (_) {}
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();

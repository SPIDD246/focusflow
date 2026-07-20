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
    for (let i = 0; i < ti; i++) {                        // các ngày đã trọn vẹn
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
      const date = daysAgo(ti + 1 + i);   // lùi tiếp từ ngày trước Thứ 2 của tuần này
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
      focusMinutes: XP,                 // 1 XP = 1 phút học (đúng quy ước app.js)
      theme: "dark",
      reminders: { enabled: true, lead: 10, summary: false },
      rpg: {
        xp: XP,
        stats: { int: 2100, dis: 1450, foc: XP, str: 620 },
        seeded: true,                   // đừng backfill lại XP từ focusMinutes
        train: "int",
        totalSessions: 63,
        questsClaimed: 41,
        bossesDefeated: 3,
        // perksSeen/achSeen bỏ trống → app.js tự backfill IM LẶNG (không spam popup mở khoá).
        sysMsgDay: isoDay(new Date()),  // bỏ qua panel 【SYSTEM】 để tour không bị đè
      },
      quests: { day: isoDay(new Date()), sessions: 2, claimed: {} }, // picks tự sinh; s2 claim được ngay
      // Sát thương boss = tổng phút học TRONG TUẦN. Tự tính xem boss đã chết chưa rồi ghi đúng cờ:
      // đầu tuần boss còn sống (hiện thanh máu), cuối tuần boss đã bị hạ (hiện thẻ SLAIN + phần thưởng).
      // Ghi sẵn cờ `defeated` để app.js KHÔNG bắn lại popup "BOSS DEFEATED" mỗi lần mở demo.
      boss: { week: wk, defeated: weekDamage >= bossHp(wk) },
      demoDay: today,                   // mốc để làm mới demo mỗi ngày
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

  // Tour chỉ đi qua các panel CÒN HIỆN trong demo gọn (khớp với hidePanels ở trên).
  const TOUR = [
    { sel: ".hero-card",     title: "Nhân vật của bạn",   body: "Mỗi phút học = 1 XP. XP lên level, mở danh hiệu và chỉ số INT / DIS / FOC / STR trên radar." },
    { sel: "#week",          title: "Bảng nhiệm vụ tuần", body: "Thời khoá biểu cả tuần. Bấm “+ New Quest” để thêm buổi học, bấm vào buổi để đánh dấu hoàn thành." },
    { sel: ".timer-card",    title: "Đồng hồ Train",      body: "Hẹn giờ tập trung (25/45/15 phút). Chạy tới đâu cộng XP tới đó — chọn chỉ số muốn luyện ở hàng TRAIN." },
    { sel: "#questList",     title: "Nhiệm vụ hằng ngày", body: "Mỗi ngày bốc 4 nhiệm vụ mới. Xong thì bấm CLAIM để nhận XP thưởng — thử ngay, có cái claim được đấy!" },
    { sel: ".card.glow",     title: "Nhật ký tuần",       body: "Nhiệm vụ, số buổi hoàn thành, giờ đã học, và chuỗi ngày liên tiếp 🔥." },
    { sel: "#barChart",      title: "Biểu đồ tập trung",  body: "Số phút học từng ngày trong tuần." },
  ];

  const css = `
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
    if (!el || el.offsetParent === null) { go(i + 1); return; }   // không có / đang ẩn → bỏ qua bước

    tip.innerHTML = `
      <div class="ffd-step">BƯỚC ${step + 1} / ${TOUR.length}</div>
      <h3></h3><p></p>
      <div class="ffd-nav">
        <button class="ffd-skip">Bỏ qua</button>
        ${step > 0 ? '<button class="ffd-prev">← Trước</button>' : ""}
        <button class="pri ffd-next">${step === TOUR.length - 1 ? "Xong ✓" : "Tiếp →"}</button>
      </div>`;
    tip.querySelector("h3").textContent = s.title;
    tip.querySelector("p").textContent = s.body;
    tip.querySelector(".ffd-skip").onclick = endTour;
    tip.querySelector(".ffd-next").onclick = () => go(step + 1);
    const prev = tip.querySelector(".ffd-prev");
    if (prev) prev.onclick = () => go(step - 1);

    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setTimeout(place, 380);   // đợi scroll xong mới đo toạ độ
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

    // Demo không có cloud → giấu nút Đăng nhập / Link riêng cho khỏi gây hiểu nhầm.
    ["syncBtn", "linkBtn"].forEach((id) => { const b = document.getElementById(id); if (b) b.hidden = true; });

    // Demo GỌN: ẩn các panel phụ để người xem chỉ tập trung vào tính năng cốt lõi.
    // Giữ lại: Nhân vật/XP · Lịch tuần · Đồng hồ Train · Nhiệm vụ ngày · Nhật ký tuần · Biểu đồ.
    // Ẩn đi:   Cây kỹ năng · Boss tuần · Nhạc tập trung · Nhắc học & dữ liệu.
    hidePanels();

    const bar = document.createElement("div");
    bar.className = "ffd-bar";
    bar.innerHTML = `
      <span class="ffd-tag">DEMO</span>
      <span class="ffd-txt">Dữ liệu mẫu · không lưu vào tài khoản nào</span>
      <button class="pri ffd-tour">▶ Xem hướng dẫn</button>
      <button class="ffd-reset">↺ Đặt lại</button>
      <button class="ffd-exit">Thoát</button>`;
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

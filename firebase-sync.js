// firebase-sync.js — Google login + Firestore cloud sync cho FocusFlow
// Module ESM, nạp qua <script type="module">. Giao tiếp với app.js (non-module) qua window.FF.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyChZ33G_Dqprk60HIeiDF-5O1_Y58PitCY",
  authDomain: "focusflow-p1.firebaseapp.com",
  projectId: "focusflow-p1",
  storageBucket: "focusflow-p1.firebasestorage.app",
  messagingSenderId: "267720934199",
  appId: "1:267720934199:web:859d6981ca63ba0f5a50b2",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let saveTimer = null;

// Set persistence ngay khi khởi tạo (trước onAuthStateChanged) để phiên đăng nhập BỀN qua các lần mở link.
// Nhờ vậy: login 1 lần trên trình duyệt → lần sau ấn link là tự nhận diện + tự tải progress, không cần bấm ☁️ lại.
const persistenceReady = setPersistence(auth, browserLocalPersistence).catch((e) => console.warn("persistence", e));

// Bridge tới app.js: app.js định nghĩa window.FF = { getState, setState, onSyncStatus }
const FF = () => window.FF || {};

function status(text, state) {
  const fn = FF().onSyncStatus;
  if (typeof fn === "function") fn(text, state, currentUser);
}

// ---- Đăng nhập / Đăng xuất ----
async function login() {
  try {
    status("Đang đăng nhập…", "syncing");
    await persistenceReady;
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.warn("login error", e);
    status(e.code === "auth/popup-blocked" ? "Popup bị chặn — cho phép popup rồi thử lại" : "Đăng nhập thất bại", "error");
  }
}
async function logout() {
  try { await signOut(auth); } catch (_) {}
}

// ---- Đồng bộ (chế độ TÀI KHOẢN) ----
// Hai kho tách biệt cho mỗi người dùng đã đăng nhập:
//   users/{uid} = HỒ SƠ TÀI KHOẢN (tên, email, ảnh, ngày tạo, tóm tắt tiến trình)  ~ "users.json"
//   data/{uid}  = DỮ LIỆU HỌC (toàn bộ state: lịch, focus, RPG, quest…)              ~ "data.json"
const userRef = (uid) => doc(db, "users", uid);
const dataRef = (uid) => doc(db, "data", uid);

// Tóm tắt tiến trình nhét kèm hồ sơ → sau này làm bảng xếp hạng / xem nhanh mà không phải tải cả data.
function progressSummary(st) {
  if (!st) return { xp: 0, sessions: 0, focusMinutes: 0 };
  return {
    xp: (st.rpg && st.rpg.xp) || 0,
    sessions: (st.sessions && st.sessions.length) || 0,
    focusMinutes: st.focusMinutes || 0,
  };
}

// Merge dữ liệu: bản có updatedAt lớn hơn thắng. Local trống → luôn nạp cloud (chống đè mất data).
async function syncOnLogin(user) {
  const st = FF().getState ? FF().getState() : null;
  const localUpdatedAt = (st && st.updatedAt) || 0;
  try {
    // 1) Ghi/cập nhật HỒ SƠ TÀI KHOẢN → users/{uid} (merge để giữ createdAt của lần đầu).
    const uSnap = await getDoc(userRef(user.uid));
    await setDoc(userRef(user.uid), {
      uid: user.uid,
      name: user.displayName || "",
      email: user.email || "",
      photo: user.photoURL || "",
      lastLoginAt: Date.now(),
      progress: progressSummary(st),
      ...(uSnap.exists() && uSnap.data().createdAt ? {} : { createdAt: Date.now() }),
    }, { merge: true });

    // 2) Đồng bộ DỮ LIỆU HỌC → data/{uid}.
    let dSnap = await getDoc(dataRef(user.uid));
    // Di trú 1 lần: dữ liệu cũ (nếu có) từng nằm chung trong users/{uid}.state → dời sang data/{uid}.
    if (!dSnap.exists() && uSnap.exists() && uSnap.data().state) {
      await setDoc(dataRef(user.uid), {
        state: uSnap.data().state,
        updatedAt: uSnap.data().updatedAt || 0,
        syncedAt: Date.now(),
      });
      dSnap = await getDoc(dataRef(user.uid));
    }
    const cloudHasData = dSnap.exists() && dSnap.data().state;
    const cloudUpdatedAt = cloudHasData ? (dSnap.data().updatedAt || 0) : 0;
    if (cloudHasData && (cloudUpdatedAt > localUpdatedAt || isLocalEmpty(st))) {
      FF().setState && FF().setState(JSON.parse(dSnap.data().state));   // cloud mới hơn / local trống → nạp cloud
      status("Đã tải tiến trình từ cloud", "ok");
    } else {
      await pushToCloud(user);                                          // local mới hơn / cloud trống → đẩy lên
      status(cloudHasData ? "Đã đồng bộ lên cloud" : "Đã tạo tài khoản + sao lưu", "ok");
    }
  } catch (e) {
    console.warn("sync error", e);
    status("Lỗi đồng bộ (kiểm tra rules)", "error");
  }
}

async function pushToCloud(user) {
  const st = FF().getState ? FF().getState() : null;
  if (!st) return;
  // CHỐNG MẤT DATA: local đang trống mà cloud đã có tiến trình → KHÔNG ghi đè.
  try {
    const snap = await getDoc(dataRef(user.uid));
    if (snap.exists() && snap.data().state) {
      const cloud = JSON.parse(snap.data().state);
      if (isLocalEmpty(st) && stateWeight(cloud) > 0) { console.warn("push chặn: local trống, cloud có data"); return; }
    }
  } catch (_) {}
  await setDoc(dataRef(user.uid), {                        // DỮ LIỆU → data/{uid}
    state: JSON.stringify(st),
    updatedAt: st.updatedAt || Date.now(),
    syncedAt: Date.now(),
  });
  await setDoc(userRef(user.uid), {                        // cập nhật tóm tắt trong HỒ SƠ
    progress: progressSummary(st),
    lastSyncAt: Date.now(),
  }, { merge: true });
}

// app.js gọi hàm này mỗi khi save() — debounce để đỡ tốn quota
function scheduleSync() {
  // Chế độ link riêng: ghi lên links/{key} thay vì users/{uid}
  if (linkKey) { scheduleKeyPush(); return; }
  if (!currentUser) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try { await pushToCloud(currentUser); status("Đã lưu lên cloud", "ok"); }
    catch (e) { console.warn(e); status("Lỗi lưu cloud", "error"); }
  }, 2000);
}

// ================= CHẾ ĐỘ LINK RIÊNG (mã bí mật trong URL #k=) =================
// Doc id = mã bí mật dài. Ai có đúng mã trong link đều tự tải/ghi được, không cần login.
// KHÔNG còn mã cố định: mở link gốc (không có #k=) → chạy chế độ TÀI KHOẢN (đăng nhập Google),
// mỗi người có kho riêng users/{uid} + data/{uid}. Link riêng (#k=) chỉ dùng khi chủ động tạo để chia sẻ.
// (Khôi phục kho chia sẻ cũ: mở URL kèm #k=cekak3W-TgwjLrT3KBrCcP1zVARK6Hpa.)
let linkKey = readLinkKey();
let pullDone = false;   // chặn mọi push lên cloud cho tới khi pull lần đầu hoàn tất (tránh state rỗng đè data)

function readLinkKey() {
  try {
    const m = (location.hash || "").match(/[#&]k=([A-Za-z0-9_-]{24,})/);
    return m ? m[1] : null;   // không có mã trong URL → null → dùng chế độ tài khoản (đăng nhập)
  } catch (_) { return null; }
}

// Tạo mã ngẫu nhiên 32 ký tự (an toàn về entropy).
function makeKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" }[c])).slice(0, 32);
}

// "Trọng lượng" dữ liệu: dùng để chặn ghi đè khi bản mới nghèo hơn hẳn bản cloud.
function stateWeight(st) {
  if (!st) return 0;
  const xp = (st.rpg && st.rpg.xp) || 0;
  const sess = (st.sessions && st.sessions.length) || 0;
  const fm = st.focusMinutes || 0;
  return xp + fm + sess * 100;
}

async function pushToKey(key) {
  const st = FF().getState ? FF().getState() : null;
  if (!st) return;
  if (!pullDone) return;                 // an toàn: chưa pull xong thì không ghi
  const ref = doc(db, "links", key);
  // CHỐNG MẤT DATA: đọc cloud trước; nếu bản đang ghi trống/nghèo hơn HẲN bản cloud → KHÔNG ghi đè.
  try {
    const snap = await getDoc(ref);
    if (snap.exists() && snap.data().state) {
      const cloud = JSON.parse(snap.data().state);
      const wNew = stateWeight(st), wCloud = stateWeight(cloud);
      // Bản mới trống nhưng cloud có data → chặn hẳn (đây chính là lỗi đã gây mất data).
      if (isLocalEmpty(st) && wCloud > 0) { console.warn("push bị chặn: local trống, cloud có data"); return; }
      // Bản mới nghèo hơn cloud >30% và cloud không cũ hơn → nghi ngờ, giữ backup rồi mới ghi.
      if (wNew < wCloud * 0.7) {
        await setDoc(doc(db, "links", key + "__bak"), { state: snap.data().state, updatedAt: snap.data().updatedAt || Date.now(), syncedAt: Date.now() }).catch(() => {});
        console.warn("push nghi ngờ (nghèo hơn cloud) — đã giữ backup cloud cũ vào __bak");
      }
    }
  } catch (_) {}
  await setDoc(ref, { state: JSON.stringify(st), updatedAt: st.updatedAt || Date.now(), syncedAt: Date.now() });
}

// Local có được coi là "trống" (chưa có tiến trình thực) không?
// Nếu trống mà cloud có data → luôn nạp cloud (tránh state rỗng mới tạo đè lên cloud).
function isLocalEmpty(st) {
  if (!st) return true;
  const xp = (st.rpg && st.rpg.xp) || 0;
  const sess = (st.sessions && st.sessions.length) || 0;
  const fm = st.focusMinutes || 0;
  return xp === 0 && sess === 0 && fm === 0;
}

async function pullFromKey(key) {
  const st = FF().getState ? FF().getState() : null;
  const localUpdatedAt = (st && st.updatedAt) || 0;
  const ref = doc(db, "links", key);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const cloud = snap.data();
    // Nạp cloud nếu: cloud mới hơn, HOẶC local đang trống (mới xoá cache / máy mới).
    if (cloud.state && ((cloud.updatedAt || 0) > localUpdatedAt || isLocalEmpty(st))) {
      FF().setState && FF().setState(JSON.parse(cloud.state));
      pullDone = true;
      status("Đã tải tiến trình từ link riêng", "ok");
    } else {
      pullDone = true;
      await pushToKey(key);
      status("Đã đồng bộ link riêng", "ok");
    }
  } else {
    pullDone = true;
    await pushToKey(key);
    status("Đã tạo link riêng", "ok");
  }
}

function scheduleKeyPush() {
  if (!pullDone) return;   // chưa pull xong → không ghi đè cloud
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try { await pushToKey(linkKey); status("Đã lưu lên link riêng", "ok"); }
    catch (e) { console.warn(e); status("Lỗi lưu link riêng", "error"); }
  }, 2000);
}

// app.js gọi để tạo link riêng mới: sinh key, đẩy state hiện tại lên, trả link đầy đủ.
async function createPrivateLink() {
  const key = makeKey();
  try {
    linkKey = key;
    pullDone = true;
    await pushToKey(key);
    const url = location.origin + location.pathname + "#k=" + key;
    status("Đã bật link riêng", "ok");
    startKeyPolling();
    return url;
  } catch (e) {
    console.warn("createPrivateLink", e);
    linkKey = null;
    throw e;
  }
}

// Đồng bộ định kỳ khi ở chế độ link (để nhiều thiết bị mở cùng link thấy cập nhật).
let pollTimer = null;
function startKeyPolling() {
  if (!linkKey || pollTimer) return;
  pollTimer = setInterval(async () => {
    try {
      const st = FF().getState ? FF().getState() : null;
      const localUpdatedAt = (st && st.updatedAt) || 0;
      const snap = await getDoc(doc(db, "links", linkKey));
      if (snap.exists()) {
        const cloud = snap.data();
        if ((cloud.updatedAt || 0) > localUpdatedAt && cloud.state) {
          FF().setState && FF().setState(JSON.parse(cloud.state));
        }
      }
    } catch (_) {}
  }, 20000);
}

// Nếu mở link đã có #k= → vào thẳng chế độ link riêng (bỏ qua login).
if (linkKey) {
  status("🔗 Chế độ link riêng", "link");
  pullFromKey(linkKey).then(startKeyPolling).catch((e) => {
    console.warn("pullFromKey", e);
    status("Lỗi tải link riêng (kiểm tra rules)", "error");
  });
}

// ---- Theo dõi trạng thái đăng nhập (bỏ qua khi đang ở chế độ link riêng) ----
onAuthStateChanged(auth, async (user) => {
  if (linkKey) return; // chế độ link riêng không dùng auth
  currentUser = user;
  if (user) {
    status(`✓ ${user.displayName || user.email}`, "signed-in");
    await syncOnLogin(user);
  } else {
    status("Chưa đăng nhập", "signed-out");
  }
});

// Expose cho app.js gọi
window.FFSync = { login, logout, scheduleSync, createPrivateLink, get user() { return currentUser; }, get linkMode() { return !!linkKey; } };

// Báo cho app.js biết sync đã sẵn sàng
if (typeof window.onFFSyncReady === "function") window.onFFSyncReady();

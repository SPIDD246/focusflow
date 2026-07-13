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

// ---- Đồng bộ ----
// Merge: bản có updatedAt lớn hơn thắng. Nếu cloud mới hơn → nạp về local; ngược lại → đẩy lên.
async function syncOnLogin(user) {
  const st = FF().getState ? FF().getState() : null;
  const localUpdatedAt = (st && st.updatedAt) || 0;
  try {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const cloud = snap.data();
      const cloudUpdatedAt = cloud.updatedAt || 0;
      if (cloudUpdatedAt > localUpdatedAt && cloud.state) {
        // Cloud mới hơn → nạp về máy
        FF().setState && FF().setState(JSON.parse(cloud.state));
        status("Đã tải tiến trình từ cloud", "ok");
      } else {
        // Local mới hơn (hoặc bằng) → đẩy lên
        await pushToCloud(user);
        status("Đã đồng bộ lên cloud", "ok");
      }
    } else {
      // Chưa có doc → tạo mới từ local
      await pushToCloud(user);
      status("Đã tạo bản sao lưu cloud", "ok");
    }
  } catch (e) {
    console.warn("sync error", e);
    status("Lỗi đồng bộ (kiểm tra rules)", "error");
  }
}

async function pushToCloud(user) {
  const st = FF().getState ? FF().getState() : null;
  if (!st) return;
  const ref = doc(db, "users", user.uid);
  await setDoc(ref, {
    state: JSON.stringify(st),
    updatedAt: st.updatedAt || Date.now(),
    email: user.email || "",
    syncedAt: Date.now(),
  });
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
// Mã CỐ ĐỊNH: khi mở link gốc (không có #k=) thì tự dùng mã này → ấn link base là hiện tiến trình.
// (Khang chấp nhận: ai mở link gốc cũng dùng chung kho dữ liệu này.)
const DEFAULT_KEY = "cekak3W-TgwjLrT3KBrCcP1zVARK6Hpa";
let linkKey = readLinkKey();
let pullDone = false;   // chặn mọi push lên cloud cho tới khi pull lần đầu hoàn tất (tránh state rỗng đè data)

function readLinkKey() {
  try {
    const m = (location.hash || "").match(/[#&]k=([A-Za-z0-9_-]{24,})/);
    return m ? m[1] : DEFAULT_KEY;   // không có mã trong URL → dùng mã cố định
  } catch (_) { return DEFAULT_KEY; }
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

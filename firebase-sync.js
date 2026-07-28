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
    status("Signing in…", "syncing");
    await persistenceReady;
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.warn("login error", e);
    status(e.code === "auth/popup-blocked" ? "Popup blocked — allow popups and try again" : "Login failed", "error");
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
      FF().setState && FF().setState(JSON.parse(dSnap.data().state));   // cloud newer / local empty → load cloud
      status("Loaded progress from cloud", "ok");
    } else {
      await pushToCloud(user);                                          // local newer / cloud empty → push up
      status(cloudHasData ? "Synced to cloud" : "Created account + backup", "ok");
    }
  } catch (e) {
    console.warn("sync error", e);
    status("Sync error (check rules)", "error");
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
      if (isLocalEmpty(st) && stateWeight(cloud) > 0) { console.warn("push blocked: local empty, cloud has data"); return; }
    }
  } catch (_) {}
  await setDoc(dataRef(user.uid), {                        // DATA → data/{uid}
    state: JSON.stringify(st),
    updatedAt: st.updatedAt || Date.now(),
    syncedAt: Date.now(),
  });
  await setDoc(userRef(user.uid), {                        // update summary in PROFILE
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
    try { await pushToCloud(currentUser); status("Saved to cloud", "ok"); }
    catch (e) { console.warn(e); status("Cloud save error", "error"); }
  }, 2000);
}

// ================= PRIVATE-LINK MODE (secret code in URL #k=) =================
// Doc id = a long secret key. Anyone with the exact key can load/write the same progress.
// Khang wants the BASE LINK to show his progress, so the base URL uses this shared DEFAULT_KEY.
const DEFAULT_KEY = "cekak3W-TgwjLrT3KBrCcP1zVARK6Hpa";
let linkKey = readLinkKey();
let pullDone = false;   // block cloud pushes until the first pull completes (prevents empty state overwrite)

function readLinkKey() {
  try {
    const m = (location.hash || "").match(/[#&]k=([A-Za-z0-9_-]{24,})/);
    return m ? m[1] : DEFAULT_KEY;   // no code in URL → use Khang's shared progress key
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
  if (!pullDone) return;                 // safety: do not write before pull is complete
  const ref = doc(db, "links", key);
  // CHỐNG MẤT DATA: đọc cloud trước; nếu bản đang ghi trống/nghèo hơn HẲN bản cloud → KHÔNG ghi đè.
  try {
    const snap = await getDoc(ref);
    if (snap.exists() && snap.data().state) {
      const cloud = JSON.parse(snap.data().state);
      const wNew = stateWeight(st), wCloud = stateWeight(cloud);
      // Bản mới trống nhưng cloud có data → chặn hẳn (đây chính là lỗi đã gây mất data).
      if (isLocalEmpty(st) && wCloud > 0) { console.warn("push blocked: local empty, cloud has data"); return; }
      // Bản mới nghèo hơn cloud >30% và cloud không cũ hơn → nghi ngờ, giữ backup rồi mới ghi.
      if (wNew < wCloud * 0.7) {
        await setDoc(doc(db, "links", key + "__bak"), { state: snap.data().state, updatedAt: snap.data().updatedAt || Date.now(), syncedAt: Date.now() }).catch(() => {});
        console.warn("suspicious push (weaker than cloud) — saved old cloud backup to __bak");
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
      status("Loaded progress from private link", "ok");
    } else {
      pullDone = true;
      await pushToKey(key);
      status("Synced private link", "ok");
    }
  } else {
    pullDone = true;
    await pushToKey(key);
    status("Created private link", "ok");
  }
}

function scheduleKeyPush() {
  if (!pullDone) return;   // pull not complete → do not overwrite cloud
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try { await pushToKey(linkKey); status("Saved to private link", "ok"); }
    catch (e) { console.warn(e); status("Private link save error", "error"); }
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
    status("Private link enabled", "ok");
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
  status("🔗 Private link mode", "link");
  pullFromKey(linkKey).then(startKeyPolling).catch((e) => {
    console.warn("pullFromKey", e);
    status("Private link load error (check rules)", "error");
  });
}

// ---- Theo dõi trạng thái đăng nhập (bỏ qua khi đang ở chế độ link riêng) ----
onAuthStateChanged(auth, async (user) => {
  if (linkKey) return; // private link mode does not use auth
  currentUser = user;
  if (user) {
    status(`✓ ${user.displayName || user.email}`, "signed-in");
    await syncOnLogin(user);
  } else {
    status("Not signed in", "signed-out");
  }
});

// Expose cho app.js gọi
window.FFSync = { login, logout, scheduleSync, createPrivateLink, get user() { return currentUser; }, get linkMode() { return !!linkKey; } };

// Báo cho app.js biết sync đã sẵn sàng
if (typeof window.onFFSyncReady === "function") window.onFFSyncReady();

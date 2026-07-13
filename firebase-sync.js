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
  if (!currentUser) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try { await pushToCloud(currentUser); status("Đã lưu lên cloud", "ok"); }
    catch (e) { console.warn(e); status("Lỗi lưu cloud", "error"); }
  }, 2000);
}

// ---- Theo dõi trạng thái đăng nhập ----
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    status(`✓ ${user.displayName || user.email}`, "signed-in");
    await syncOnLogin(user);
  } else {
    status("Chưa đăng nhập", "signed-out");
  }
});

// Expose cho app.js gọi
window.FFSync = { login, logout, scheduleSync, get user() { return currentUser; } };

// Báo cho app.js biết sync đã sẵn sàng
if (typeof window.onFFSyncReady === "function") window.onFFSyncReady();

# FocusFlow

**FocusFlow** is a gamified study planner and focus timer. It helps students organize their weekly study schedule, track focused learning time, and stay motivated through XP, levels, quests, achievements, and a weekly boss battle.

The purpose of this project is to make studying feel more visible and rewarding: every focused minute becomes progress.

---

## 1. Project Structure

```text
focusflow/
├── index.html          Main app page and layout
├── app.js              Core app logic: schedule, timer, RPG system, quests, boss, UI
├── styles.css          Main styling, responsive layout, dark/light theme, game UI
├── firebase-sync.js    Firebase login and Firestore cloud sync
├── demo.html           Demo entry page
├── demo.js             Demo-mode logic and sample behavior
├── app_data.json       App data / backup data
├── firestore.rules     Firestore security rules
├── firebase.json       Firebase project configuration
├── sw.js               Service worker for PWA cache and offline support
├── manifest.json       PWA manifest
├── icon.svg            App icon
├── avatars/            Avatar images and character assets
├── music/              Focus music files
└── docs/               Extra documents, screenshots, and reference files
```

### Important files

- **`index.html`** — the main page users open.
- **`app.js`** — contains most of the app behavior: weekly schedule, timer, XP, stats, quests, boss fight, achievements, and rendering.
- **`styles.css`** — controls the full visual design, including the game-like HUD style.
- **`firebase-sync.js`** — handles Google login and cloud sync with Firebase.
- **`demo.html` / `demo.js`** — lets users try the app with demo data.
- **`app_data.json`** — stores app data used for backup/default data.
- **`sw.js`** — service worker used for PWA caching and offline behavior.
- **`docs/screenshot.png`** — screenshot used for showing the app interface.

### Main technologies

- HTML
- CSS
- Vanilla JavaScript
- Firebase Authentication
- Firebase Firestore
- Service Worker / PWA
- GitHub Pages

---

## 2. Setup, Installation, and Use Guide

### Run the project locally

Clone the repository:

```bash
git clone https://github.com/SPIDD246/focusflow.git
cd focusflow
```

Start a local web server:

```bash
python3 -m http.server 8000
```

Open the app in your browser:

```text
http://localhost:8000/
```

Open demo mode locally:

```text
http://localhost:8000/?demo=1
```

> The project is a static web app, so there is no build step required.

---

### Install as an app

FocusFlow can be installed as a PWA.

On desktop Chrome / Edge:

1. Open the FocusFlow website.
2. Click the install icon in the address bar, or open the browser menu.
3. Choose **Install FocusFlow**.

On Android:

1. Open the website in Chrome.
2. Tap the three-dot menu.
3. Choose **Add to Home screen** or **Install app**.

After installation, FocusFlow can be opened like a normal app.

---

### How to use FocusFlow

#### Step 1: Plan your week

Use the weekly schedule board to add study sessions.

Each session can include:

- Subject name
- Day of the week
- Start time
- Duration
- Color

This gives you a clear weekly study plan.

#### Step 2: Start a focus session

Use the focus timer when you begin studying.

You can:

- Choose a preset timer length
- Enter a custom length
- Pause or reset the timer
- Play focus music
- Choose which stat to train

Every focused minute adds a small amount of XP.

#### Step 3: Gain XP and level up

Studying gives progress in the RPG system.

You can earn:

- XP
- Levels
- Stat progress
- Skill tree unlocks
- Achievement badges

The main stats are:

- **INT** — Intelligence
- **DIS** — Discipline
- **FOC** — Focus
- **STR** — Strength

#### Step 4: Complete daily quests

Daily quests give extra motivation.

When a quest is ready, claim it to receive bonus XP.

#### Step 5: Fight the weekly boss

Your study minutes deal damage to the weekly boss.

If you study enough during the week, you can defeat the boss and receive a bigger reward.

#### Step 6: Track your progress

The dashboard shows:

- Level
- XP bar
- Stats
- Streak
- Weekly study time
- Quests
- Boss progress
- Achievements

Use this to understand how consistent your learning has been.

---

### Cloud sync

FocusFlow supports cloud sync with Firebase.

Depending on the setup, data can be saved in:

- Browser local storage
- Firebase Firestore
- Google account sync

Cloud sync helps your schedule and progress appear again when you open the app on another device.

---

### If the app shows old data

Because FocusFlow uses a service worker, the browser may sometimes keep an old cached version.

If the app looks outdated:

1. Close all FocusFlow tabs.
2. Reopen the page.
3. Hard refresh with **Ctrl + Shift + R**.
4. If needed, clear site data from browser settings.

---

## 3. Demo and Image

### Demo mode

Demo mode lets users try FocusFlow without changing real study data.

Open demo mode:

```text
https://spidd246.github.io/focusflow/?demo=1
```

Demo mode is useful for:

- Testing the interface
- Showing the project to other people
- Trying the RPG features
- Exploring the app without using real progress

---

### App screenshot

![FocusFlow dashboard](docs/screenshot.png)

---

### What users can see in the demo

The demo shows the main parts of FocusFlow:

- Weekly schedule
- Focus timer
- XP and level system
- Character stats
- Daily quests
- Weekly boss
- Achievements
- Game-style dashboard UI

---

### Final note

FocusFlow is built to help students study more consistently by making progress visible. It combines planning, time tracking, and game mechanics so that every study session feels like a step forward.

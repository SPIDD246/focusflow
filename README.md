<div align="center">

# ⚔️ FocusFlow

### A gamified study planner that turns every focused minute into progress.

![HTML](https://img.shields.io/badge/HTML-Static_App-e34c26?style=for-the-badge&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS-Game_UI-264de4?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-f7df1e?style=for-the-badge&logo=javascript&logoColor=111)
![Firebase](https://img.shields.io/badge/Firebase-Cloud_Sync-ffca28?style=for-the-badge&logo=firebase&logoColor=111)
![PWA](https://img.shields.io/badge/PWA-Installable-8b5cf6?style=for-the-badge)

</div>

---

**FocusFlow** helps students organize their weekly study schedule, track focused learning time, and stay motivated through XP, levels, quests, achievements, and a weekly boss battle.

> **Purpose:** make studying feel visible, rewarding, and consistent — one focused minute at a time.

---

## 1. Project Structure

```text
focusflow/
├── index.html          Main app page and layout
├── app.js              Core app logic: schedule, timer, RPG, quests, boss, UI
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

### File guide

| File / Folder | Purpose |
|---|---|
| `index.html` | Main app shell and page layout |
| `app.js` | Schedule, timer, RPG system, quests, boss, achievements, rendering |
| `styles.css` | Visual design, responsive layout, dark/light theme, HUD styling |
| `firebase-sync.js` | Google login and Firebase cloud sync |
| `demo.html`, `demo.js` | Demo mode with sample data |
| `app_data.json` | App data / backup data |
| `firestore.rules` | Firestore database security rules |
| `sw.js` | Service worker for cache and offline behavior |
| `manifest.json` | PWA installation metadata |
| `docs/` | Screenshots, PDFs, and extra documentation |

### Tech stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, Vanilla JavaScript |
| Sync | Firebase Authentication + Firestore |
| Offline / Install | Service Worker + Web App Manifest |
| Hosting | GitHub Pages |

---

## 2. Setup, Installation, and Use Guide

### Clone the project

```bash
git clone https://github.com/SPIDD246/focusflow.git
cd focusflow
```

### Run locally

```bash
python3 -m http.server 8000
```

Open:

```text
http://localhost:8000/
```

### Open demo mode

```text
http://localhost:8000/?demo=1
```

### Install as an app

Desktop Chrome / Edge:

```text
Address bar → Install icon → Install FocusFlow
```

Android Chrome:

```text
Menu ⋮ → Add to Home screen / Install app
```

### Sync data

```text
Open the same app link on another device.
Progress can sync through Firebase / browser storage.
```

### Fix old cached version

```text
Close all FocusFlow tabs.
Open the app again.
Press Ctrl + Shift + R.
```

If it still looks old:

```text
Browser settings → Site data → Clear FocusFlow data
```

---

## 3. Demo and Image

### Demo mode

Demo mode lets users explore FocusFlow without changing real study data.

```text
https://spidd246.github.io/focusflow/?demo=1
```

### Demo includes

| Feature | What users can try |
|---|---|
| Weekly schedule | View planned study sessions |
| Focus timer | Try study timer behavior |
| XP system | See level and progress changes |
| Character stats | View INT, DIS, FOC, and STR progress |
| Daily quests | Explore quest rewards |
| Weekly boss | See the boss challenge system |
| Achievements | View badge-style milestones |
| Game UI | Experience the RPG dashboard design |

### App screenshot

![FocusFlow dashboard](docs/screenshot.png)

---

### Final note

FocusFlow is built to help students study more consistently by making progress visible. It combines planning, time tracking, and game mechanics so every study session feels like a step forward.

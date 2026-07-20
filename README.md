# ✦ FocusFlow — Your Learning Adventure

**FocusFlow** turns studying into an RPG. Plan your week, run focus sessions, and every minute you study earns XP — level up your character, unlock skills, clear daily quests, and defeat the weekly boss. A calm, game-like study companion for staying consistent.

### 👉 [**Try the live demo →**](https://spidd246.github.io/focusflow/demo.html)

No sign-up, no setup — the demo loads a sample profile so you can click around every feature. It never touches real data or accounts.

![FocusFlow dashboard](docs/screenshot.png)

---

## ✨ Features

**Plan & track**
- 🗓️ **Weekly schedule ("Quest Board")** — add study sessions (subject, day, time, colour) and tick them off as you go
- ⏱️ **Focus timer ("Training")** — 25 / 45 / 15-minute sessions (or a custom length); every focused minute becomes XP
- 📊 **Weekly journal** — sessions, completions, hours studied, and a daily **streak 🔥**
- 📈 **Focus-this-week chart** — minutes studied per day at a glance

**Gamified motivation**
- 🧙 **Character & levels** — earn XP to climb titles: Novice → Apprentice → Scholar → Master → Sage
- 🧠 **Four stats** — Intelligence, Discipline, Focus, Strength, shown on a radar + bars (pick which to train)
- 🌳 **Skill tree** — perks auto-unlock by level (e.g. *Deep Focus* +10% XP, *Weekend Warrior* ×2 XP on weekends)
- 🗡️ **Daily quests** — a fresh set each day; claim them for bonus XP
- 👹 **Weekly boss** — your study minutes are the damage; beat it for a big XP reward
- 🏆 **Achievements** — badges as you hit milestones

**Stay on track**
- 🔔 **Study reminders** + optional daily summary
- 📅 **Calendar export (.ics)** — drop your schedule into Google / Apple Calendar for native reminders
- ⏳ **Exam countdown** — days remaining to your target exam
- 🎵 **Focus music** — built-in tracks, or add your own
- 🎨 **Light / dark theme** and a custom avatar portrait

**Anywhere, synced**
- 📲 **Installable PWA** — add to your phone or desktop; works offline
- ☁️ **Cloud sync** — sign in with Google to save your progress and pick it up on any device
- 🔗 **Private share links** — share a read/write view of your progress without anyone logging in

---

## 🚀 Live links

| | Link |
|---|---|
| **Demo** (sample data, no login) | https://spidd246.github.io/focusflow/demo.html |
| **App** (real accounts) | https://spidd246.github.io/focusflow/ |

> Tip: `github.com/...` shows the **source code**; `spidd246.github.io/...` shows the **running app**.

---

## 🧩 How it works

FocusFlow is a **static web app** — just HTML, CSS, and vanilla JavaScript, no framework and no build step.

- **Progress** is saved in your browser (`localStorage`) and, when you sign in, mirrored to the cloud.
- **Accounts** use Firebase: your profile lives in `users/{uid}` and your learning data in `data/{uid}`.
- **Demo mode** (`?demo=1` or `/demo.html`) runs on a separate sandbox key and skips Firebase entirely, so showing it off never risks real data.
- **Offline** support comes from a service worker (network-first, so it's always fresh online).

## 🛠️ Tech stack

- Vanilla **HTML / CSS / JavaScript** (no framework, no bundler)
- **Firebase** 10.12.2 — Authentication (Google) + Cloud Firestore
- **PWA** — Web App Manifest + Service Worker
- **GitHub Pages** hosting, auto-deployed on every push via GitHub Actions

## 💻 Run it locally

It's a static site, so any web server works:

```bash
git clone https://github.com/SPIDD246/focusflow.git
cd focusflow
python3 -m http.server 8000
# then open http://localhost:8000/index.html?demo=1
```

The **demo** runs anywhere. Google sign-in only works on the project's authorised domains (like the GitHub Pages URL), so use demo mode for local tinkering.

## 📂 Project structure

```
index.html          App shell / layout
app.js              Core logic — schedule, timer, RPG, quests, boss, UI
styles.css          Styling (light + dark, sci-fi HUD theme)
firebase-sync.js    Google login + Firestore cloud sync (accounts)
demo.js             Demo mode — sample data + guided tour + fake login
demo.html           Clean shareable link → opens the demo
firestore.rules     Firestore security rules
sw.js               Service worker (PWA / offline)
manifest.json       PWA manifest
docs/               Study roadmap & schedule docs, screenshot
```

---

<p align="center"><i>Made for staying consistent, one focused minute at a time.</i> ✦</p>

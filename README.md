# FocusFlow

**FocusFlow** is a gamified study planner and focus timer. It helps you plan your weekly learning schedule, track every focused minute, and stay motivated through XP, levels, quests, achievements, and a weekly boss battle.

The goal is simple: **make consistent studying feel rewarding**.

---

## Live App

- **Main app:** https://spidd246.github.io/focusflow/
- **Demo mode:** https://spidd246.github.io/focusflow/?demo=1
- **Source code:** https://github.com/SPIDD246/focusflow

> Use the main app for real progress. Use demo mode if you only want to explore the features with sample data.

---

## What FocusFlow Is For

FocusFlow is designed for students who want to:

- Organize their weekly study schedule
- Track focused study time
- Build a study streak
- Turn learning progress into XP and levels
- Make daily study feel more like a game
- Use one app across different devices

Instead of only showing a boring timer, FocusFlow turns your learning into an RPG-style system:

- Study sessions become **training**
- Tasks become **quests**
- Weekly effort becomes **boss damage**
- Progress becomes **XP, levels, stats, and achievements**

---

## Main Features

### 1. Weekly Study Schedule

Plan your week by adding study sessions.

Each session can include:

- Subject name
- Day of the week
- Start time
- Duration
- Color label

You can use this as your main weekly learning timetable.

---

### 2. Focus Timer

Use the built-in timer when you start studying.

The timer supports:

- Preset study lengths
- Custom minutes
- Pause and reset
- Focus music
- XP gain while studying

Every completed minute adds a small amount of XP, so progress grows while you study — not only after finishing a big task.

---

### 3. RPG Progress System

FocusFlow turns your learning into character progress.

You can earn:

- **XP** from studying, quests, and bosses
- **Levels** as your XP increases
- **Stats** based on how you train
- **Skill tree perks** as you level up
- **Achievements** for milestones

The main stats are:

- **INT** — Intelligence
- **DIS** — Discipline
- **FOC** — Focus
- **STR** — Strength

These stats give a quick visual summary of your learning style and consistency.

---

### 4. Daily Quests

Each day, FocusFlow gives you study-related quests.

Examples:

- Study for a certain number of minutes
- Complete multiple focus sessions
- Keep your training consistent

Finishing quests gives bonus XP and makes your daily work feel more rewarding.

---

### 5. Weekly Boss

The weekly boss is a larger challenge based on your study effort.

Your focus minutes deal damage to the boss. If you study enough during the week, you can defeat it and earn a bigger reward.

This gives you a clear weekly goal instead of only tracking day-by-day progress.

---

### 6. Achievements and Badges

FocusFlow includes achievement badges for progress milestones, such as:

- Level milestones
- Study streaks
- Focus time milestones
- Quest progress
- Boss defeats

Badges help you see how far you have come.

---

### 7. Cloud Sync

FocusFlow can save progress so it works across devices.

The app supports:

- Browser local saving
- Firebase cloud sync
- Google account login
- Shared progress loading from the main link

This means your schedule and study progress can appear again when you open the app from another device.

---

## How to Use the App

### Step 1: Open FocusFlow

Go to:

https://spidd246.github.io/focusflow/

Wait for the app to load your saved progress.

---

### Step 2: Check Your Weekly Schedule

Your weekly schedule appears on the main board.

Use it to see:

- What subjects you need to study
- Which day each session happens
- The time and length of each study block

---

### Step 3: Start a Training Session

When you begin studying:

1. Choose the stat you want to train
2. Set the timer length
3. Press the train/start button
4. Study until the timer ends, or stop when needed

Your XP increases gradually as you study.

---

### Step 4: Complete Quests

After studying, check the quest board.

If a quest is ready, claim it to receive extra XP.

---

### Step 5: Track Your Progress

Use the dashboard to check:

- Level
- XP bar
- Stats
- Streak
- Weekly study minutes
- Achievements
- Boss progress

This helps you understand whether you are staying consistent.

---

### Step 6: Use It on Another Device

Open the same link on another device:

https://spidd246.github.io/focusflow/

Your progress should load from cloud sync.

If the app looks outdated or progress does not appear, refresh the page or clear the browser cache.

---

## Demo Mode

Demo mode is for testing the app without using real study data.

Open:

https://spidd246.github.io/focusflow/?demo=1

Use demo mode when you want to:

- Explore the interface
- Try the RPG features
- Show the app to someone else
- Test without changing real progress

---

## Data and Privacy Notes

FocusFlow stores learning data such as:

- Weekly schedule
- XP and levels
- Study minutes
- Quest progress
- Boss progress
- Achievement progress

Depending on the mode, data may be saved in:

- The browser's local storage
- Firebase Firestore cloud storage

Do not share private links or project credentials with people you do not trust.

---

## Tech Stack

FocusFlow is built as a simple static web app.

- **HTML** — app structure
- **CSS** — visual design and responsive layout
- **Vanilla JavaScript** — app logic
- **Firebase Auth** — Google login
- **Firebase Firestore** — cloud sync
- **Service Worker** — offline support and caching
- **GitHub Pages** — hosting

No build step is required.

---

## Run Locally

Clone the repository:

```bash
git clone https://github.com/SPIDD246/focusflow.git
cd focusflow
```

Start a local web server:

```bash
python3 -m http.server 8000
```

Open:

```text
http://localhost:8000/
```

For demo mode:

```text
http://localhost:8000/?demo=1
```

> Google login may only work on authorized Firebase domains. Demo mode is best for local testing.

---

## Project Structure

```text
index.html          Main app page
app.js              Core app logic: schedule, timer, RPG system, quests, boss, UI
styles.css          App styling, themes, responsive layout, game UI
firebase-sync.js    Firebase login and cloud sync
demo.js             Demo-mode data and behavior
demo.html           Demo entry page
app_data.json       Saved/default app data
firestore.rules     Firestore security rules
sw.js               Service worker for caching and offline support
manifest.json       PWA manifest
music/              Focus music files
avatars/            Avatar assets
docs/               Extra documentation and images
```

---

## Why This App Exists

Studying consistently is hard because progress often feels invisible.

FocusFlow makes progress visible by turning small actions into rewards:

- One minute studied becomes XP
- A finished session becomes progress
- A day of effort becomes quests completed
- A week of effort becomes a boss battle

The app is meant to help you keep going, one focused minute at a time.

---

## License

This project is personal/educational unless a license is added later.

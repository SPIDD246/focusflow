# Focus Music files

Put your `.mp3` files in this folder. The app plays them offline (no internet needed).

## Default filenames the app already looks for

- `study.mp3`
- `sleep.mp3`
- `synthwave.mp3`

Drop files with those exact names here and the existing buttons just work.

## Adding your own track

1. Copy your `.mp3` into this `music/` folder, e.g. `music/piano.mp3`.
2. Open `app.js`, find the `TRACKS` list, and add a line:

   ```js
   { id: "piano", file: "music/piano.mp3", label: "🎹 Piano" },
   ```

   - `id` — any unique short name
   - `file` — the path to your file
   - `label` — the button text (emoji optional)

3. Reload the app. A new button appears automatically.

## Where to get music you're allowed to use

Use your own recordings, or free/royalty-free sources such as:
- Pixabay Music, Free Music Archive, Incompetech, ccMixter (check each track's license)

⚠️ Don't rip copyrighted YouTube songs — that breaks YouTube's terms and copyright law.

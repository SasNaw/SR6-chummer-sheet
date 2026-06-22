# SR6 Ammo Tracker

A mobile-friendly, offline web app for tracking Shadowrun 6 weapon ammunition
across multiple characters. Vanilla HTML/CSS/JS, no build step, installable as a
PWA. Import characters from `sr6char` XML exports; back up everything as JSON.

**Live app:** https://sasnaw.github.io/SR6-chummer-sheet/ (once GitHub Pages is enabled — see Deploy)

## Usage

- **Characters** — manage several characters from the home screen; add a blank
  one, import from a Chummer-style `sr6char` XML export, or restore a JSON backup.
- **Weapon cards** — each weapon shows its loaded rounds over magazine capacity, a
  mount badge (Carried, or the drone/vehicle name), the currently-loaded ammo type,
  and free-text notes.
- **Firing** — tap a firing-mode button (e.g. `SA`, `BF`, `FA`) to subtract that
  mode's round cost; use `−` / `+` / `Set` for manual corrections.
- **Reserves & reload** — track spare ammo pools per category and type. `Reload`
  refills the magazine from a matching pool; switching ammo type returns the
  leftover rounds to reserve so nothing is wasted.
- **Backup** — export all characters to a JSON file and re-import it on any device.

Everything is stored on-device in the browser; install to your home screen to use
it fully offline at the table.

## Develop

Run tests: `npm install` then `npm test`.

Serve locally (ES modules need HTTP, not `file://`):
`python3 -m http.server 8000` then open http://localhost:8000

## Deploy

GitHub Pages, served from the `main` branch root. Pushing publishes.

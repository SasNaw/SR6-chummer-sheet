# SR6 Ammo Tracker

A mobile-friendly, offline web app for tracking Shadowrun 6 weapon ammunition
across multiple characters. Vanilla HTML/CSS/JS, no build step, installable as a
PWA. Import characters from `sr6char` XML exports; back up everything as JSON.

## Develop

Run tests: `npm install` then `npm test`.

Serve locally (ES modules need HTTP, not `file://`):
`python3 -m http.server 8000` then open http://localhost:8000

## Deploy

GitHub Pages, served from the `main` branch root. Pushing publishes.

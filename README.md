# Desktop Companion

A Linux desktop companion for developers, built with Electron, React, TypeScript, and Three.js. It combines a transparent animated character with a separate dashboard for companion settings, reminders, and offline Git commit-message reviews.

**Repository:** [github.com/VaibhavKhushalani/desktop-companion](https://github.com/VaibhavKhushalani/desktop-companion)

## Features

- Transparent, frameless floating companion window.
- Separate dashboard window so dashboard navigation does not reset the companion.
- Character selection with bundled `female.fbx`, `male.fbx`, and `penguin.fbx` models.
- FBX walking and talking animations loaded from `public/models/walking.fbx` and `public/models/talking.fbx`.
- Character sequence: walk in from the left, turn toward the user, show a message, walk to the right, and remain visible in a stationary idle pose.
- Character scale control; the reminder bubble scales proportionally with the character.
- Configurable speech-bubble content and companion placement.
- Local reminders and deterministic, offline Git commit-message judging.
- Electron system-tray and window controls.
- Local settings persistence.

> The current model assets include walking and talking animations, but no separate idle animation. After the character walks to the right, the walking/talking actions stop so the character remains visible and stationary. Add a dedicated idle FBX later if you want a breathing or other idle loop.

## Requirements

- Linux (developed for Kali Linux; other desktop environments may behave differently).
- Node.js and npm versions compatible with the versions in `package.json`.
- Internet access for the first dependency installation, unless all packages are already cached.

## Install

Clone the repository and install dependencies:

```bash
git clone https://github.com/VaibhavKhushalani/desktop-companion.git
cd desktop-companion
npm ci
```

If you are working from a downloaded ZIP instead, extract it, open a terminal in the extracted project folder, and run `npm install` (or `npm ci` if the lockfile is present and up to date).

## Install and run

Requirements: Node.js 22 or newer and npm. Install dependencies from the repository root:

```bash
npm ci
```

Start the Vite + Electron development application:

```bash
npm run electron:dev
```

Build the web assets and type-check the application:

```bash
npm run build
```

Run lint checks:

```bash
npm run lint
```

## Package installers

Build on the target operating system for the most reliable results. Native signing/notarization may be required for distributing macOS builds.

```bash
# Linux: AppImage and Debian package
npm run dist:linux

# Windows: NSIS installer
npm run dist:win

# macOS: DMG and ZIP
npm run dist:mac

# Attempt all configured targets (best run on a supported build host)
npm run dist:all
```

The production build is written to `dist/`; installers are written to `release/`. The Linux AppImage may require FUSE 2 compatibility on some distributions. On Kali Linux, if FUSE is unavailable, extract it with `--appimage-extract` and launch `squashfs-root/AppRun`.

**Platform note:** Electron Builder can package Windows, macOS, and Linux targets, but building macOS artifacts is most reliable on macOS, and code signing/notarization credentials are needed for trusted public distribution. Cross-building native modules and signing may not work from every host OS.

## Repository

https://github.com/VaibhavKhushalani/desktop-companion


## License

MIT. Free to fork, adapt, and use as your own portfolio.

## Author

**Vaibhav Khushalani** — Full Stack Engineer & AI Builder

[GitHub](https://github.com/VaibhavKhushalani) · [LinkedIn](https://www.linkedin.com/in/vaibhav-khushalani-760217136) · [Medium](https://medium.com/@vaibhavkhushalani) · [Instagram](https://www.instagram.com/vaibhav.create) · [YouTube](https://www.youtube.com/@vaibhav.create)


## Scheduled reminders

Open **Reminders** in the dashboard, enter a title, message, and future date/time, then select **Schedule reminder**. At the scheduled time, the dashboard triggers a desktop notification and sends the message to the companion bubble. Keep the application running for scheduled reminders to fire. Reminder data is saved locally; completed and unwanted reminders can be managed from the same screen.


## Latest update

- Dashboard navigation is focused on **Reminders**, **Git Judge**, and **Bubble UI**.
- **Bubble UI** includes character selection and character scaling, plus bubble scale, font size, width, background color, text color, and accent color controls. Preferences are saved locally.
- The companion now walks to the right and remains visible in a screen-facing standing/gesture loop. The bundled assets do not contain a dedicated idle animation, so the talking/gesture clip is reused as the standing loop.
- Scheduled reminders trigger while the application is running; the app must remain open for in-app scheduling checks.


## Production and Windows build fixes

- The packaged dashboard and companion now use one shared local static-server origin, so Bubble UI changes saved in `localStorage` synchronize in the packaged app as they do in development.
- Bubble and character defaults are smaller, saved values are clamped to safe limits, and bubble text wraps within the companion viewport.
- Reminder and Git Judge messages are temporary (5 seconds); the companion then returns to the editable default greeting configured in **Bubble UI**.
- Build the Windows installer with `npm run dist:win`. The generated NSIS installer is written to `release/` and targets x64. Run this command on a supported Node.js version (Node 22 LTS recommended) with network access for dependency installation.
- Before packaging, run `npm ci`, `npm run lint`, and `npm run build`.

# RankedStats Desktop

Electron desktop wrapper for the existing local `index.html` site. The UI is bundled into the app; live Ranked API data and other remote resources still require an internet connection.

## Build on Windows

1. Install Node.js 22 or newer.
2. Clone this repository and open a terminal in the project directory.
3. Run:

```powershell
npm install
npm run dist:win
```

The Windows installer is written to `dist/RankedStats-Setup-1.0.0.exe`.

## Build from GitHub

Open **Actions → Build Windows desktop installer → Run workflow**. Download the `RankedStats-Windows-Installer` artifact when the workflow completes.

The installer creates Start Menu and desktop shortcuts. The desktop app loads the repository's bundled `index.html`; it does not simply open the hosted website.

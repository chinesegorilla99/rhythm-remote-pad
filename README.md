# Rhythm Remote Pad

A mobile web app controller for the Roku Osu Mania rhythm game. This app allows you to use your phone as a controller instead of the Roku remote during gameplay.

## Features

- 4 touch-responsive lane buttons in landscape mode
- Support for both tap and long-press (for hold notes)
- Direct communication with Roku via ECP (External Control Protocol)
- Works on any device with a modern web browser
- Roku remote still works for testing

## Prerequisites

- Node.js (v18+) installed on your computer
- npm (comes with Node.js)
- Your phone and computer must be on the same WiFi network
- Your Roku device must be on the same WiFi network

## Quick Start

### 1. Install Dependencies

```bash
cd tools/rhythm-remote-pad
npm install --legacy-peer-deps
```

### 2. Start the Development Server

```bash
npm run dev -- --host
```

This will show output like:
```
VITE v5.4.19  ready in 196 ms

➜  Local:   http://localhost:8080/
➜  Network: http://192.168.x.x:8080/
```

### 3. Open on Your Phone

**Option A: Scan QR Code**
```bash
open qr-code.html
```
Scan the QR code with your phone's camera.

**Option B: Type URL**
Open your phone's browser and go to `http://[your-computer-ip]:8080/`

### 4. Enter Your Roku IP

When the app opens:
1. Go to your Roku: **Settings → Network → About**
2. Find your Roku's IP address (e.g., `192.168.1.50`)
3. Enter it in the app and tap **Connect**

### 5. Play!

1. Start the Roku Osu Mania game on your TV
2. Navigate to a song and start playing
3. Use your phone to tap the lane buttons during gameplay
4. The Roku remote still works too!

## How It Works

The app sends key presses directly to your Roku using the **External Control Protocol (ECP)**:

| Phone Button | Roku Key | Game Lane |
|--------------|----------|-----------|
| Button 1     | Left     | Lane 1    |
| Button 2     | Up       | Lane 2    |
| Button 3     | Down     | Lane 3    |
| Button 4     | Right    | Lane 4    |

This is the same protocol the official Roku mobile app uses!

## Firewall Setup (if connection fails)

If your phone can't connect to the dev server:

**macOS:**
1. Open **System Settings** → **Privacy & Security** → **Firewall**
2. Click **Firewall Options**
3. Click **+** and navigate to `/usr/local/bin/node`
4. Set to **Allow incoming connections**
5. Click **OK**

If your phone can't connect to the Roku:
- Make sure all devices are on the same WiFi network
- Check that "Network Access" is enabled on your Roku

## Building for Production

```bash
npm run build
```

The built files will be in the `dist/` folder.

## Hosting Online

To host the app for easier access:

1. **Vercel** (recommended): Connect your repo and deploy
2. **Netlify**: Drag and drop the `dist/` folder
3. **GitHub Pages**: Push `dist/` to gh-pages branch

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (localhost only) |
| `npm run dev -- --host` | Start dev server (network accessible) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm test` | Run tests |

## Troubleshooting

### "Safari can't connect to the server"
- Ensure phone and computer are on the same WiFi
- Check that the dev server is running
- Add Node.js to firewall exceptions

### Button presses not working on Roku
- Verify the Roku IP is correct
- Make sure the game is in gameplay mode (not paused/menu)
- Check browser console for errors
- Ensure Roku is on the same WiFi network

### High latency / delayed inputs
- Move phone closer to WiFi router
- Close other apps on your phone
- Use 5GHz WiFi if available

## License

Part of the Roku Osu Mania project.

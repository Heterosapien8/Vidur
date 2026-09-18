# Vidur Monorepo

Vidur is an AI-powered screen capture and analysis platform consisting of a Manifest V3 Chrome Extension, an Express backend server, and shared TypeScript type contracts.

---

## 📁 Repository Structure

```
vidur/
├── extension/          # Manifest V3 Chrome extension
│   ├── manifest.json   # Extension metadata and permissions
│   ├── background.js   # Service worker (message forwarding)
│   ├── content-script.js # Content script injected into web pages
│   ├── popup/          # Extension popup UI
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   └── icons/          # Extension icons (16x16, 48x48, 128x128)
├── server/             # Node.js / Express backend
│   ├── src/
│   │   ├── index.js    # Express entry point (Port 3000)
│   │   └── routes/     # Route handlers
│   │       └── health.js
│   └── package.json
├── shared/             # TypeScript shared types between extension and server
│   └── schema-types.ts
├── .gitignore
└── README.md
```

---

## 🚀 Getting Started

### 1. Load the Chrome Extension (Manifest V3)

To load and run the extension in Google Chrome:

1. Open Google Chrome and navigate to:
   ```
   chrome://extensions
   ```
2. Enable **Developer mode** using the toggle in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the `extension/` folder inside this repository (`vidur/extension`).
5. The **Vidur** extension will appear in your installed extensions list.
6. Pin Vidur to your browser toolbar and click the icon to open the popup with the **Capture Screen** button.

---

### 2. Run the Express Backend Server

1. Open your terminal and navigate to the `server/` directory:
   ```bash
   cd server
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Start the development server (with automatic hot reloading via `nodemon`):
   ```bash
   npm run dev
   ```
   *Alternatively, start in standard production mode:*
   ```bash
   npm start
   ```
4. Verify the server is running by opening:
   ```
   http://localhost:3000/health
   ```
   You should receive:
   ```json
   { "status": "ok" }
   ```

---

## 🧩 Shared Types

The `shared/schema-types.ts` file contains shared TypeScript definitions and interfaces used across both the Chrome extension communication channels and the Node.js backend API contracts.

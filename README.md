# Vidur Monorepo

Vidur is an AI-powered screen capture and analysis platform consisting of a Manifest V3 Chrome Extension, an Express backend server, and shared TypeScript type contracts.

---

## 📁 Repository Structure

```
vidur/
├── extension/            # Manifest V3 Chrome extension
│   ├── manifest.json     # Extension metadata and permissions
│   ├── background.js     # Service worker (capture & DOM extraction coordinator)
│   ├── content-script.js # Accessibility DOM tree extractor & element listener
│   ├── popup/            # Extension popup UI
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   ├── test-page/        # Local test forms and playground
│   │   └── login-test.html
│   └── icons/            # Extension icons (16x16, 48x48, 128x128)
├── server/               # Node.js / Express backend
│   ├── src/
│   │   ├── index.js      # Express entry point (Port 3000)
│   │   └── routes/       # Route handlers
│   │       └── health.js
│   ├── test-dom-extraction.js # Automated DOM extractor test suite
│   └── package.json
├── shared/               # TypeScript shared types between extension and server
│   └── schema-types.ts
├── .gitignore
└── README.md
```

---

## 🚀 Getting Started

### 1. Load the Chrome Extension (Manifest V3)

1. Open Google Chrome and navigate to:
   ```
   chrome://extensions
   ```
2. Enable **Developer mode** using the toggle in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the `extension/` folder inside this repository (`vidur/extension`).
   *(If previously loaded, click the **Reload** (🔄) icon on the Vidur extension card).*
5. Pin **Vidur** to your browser toolbar.

---

### 2. Run the Express Backend Server & Test Page

1. Open your terminal and navigate to the `server/` directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Confirm health check:
   ```
   http://localhost:3000/health
   ```
5. Open the test login page in your browser:
   ```
   http://localhost:3000/test/login-test.html
   ```

---

### 3. Test the Capture Layer

1. Open `http://localhost:3000/test/login-test.html` (or any web page with form fields).
2. Click the **Vidur** extension icon in your Chrome toolbar.
3. Click **Capture Screen**:
   - 📸 **Viewport Screenshot**: Renders as an image preview in the popup (click to inspect in full resolution).
   - ⚡ **Element Count**: Displays total interactive elements found.
   - 📋 **Extracted Accessibility Tree**: Collapsible, formatted JSON view detailing every interactive element (`tag`, `role`, `label`, `type`, `autocomplete`, `bbox`, `value`).
   - 📋 **Copy JSON**: One-click copy of the extracted payload to your clipboard.

---

### 4. Run Automated DOM Extraction Tests

To run the automated headless JSDOM test suite:
```bash
cd server
npm test
```

---

## 🧩 Shared Types

The `shared/schema-types.ts` file defines type contracts shared between the extension and backend:
- `DOMElementNode`: Schema for each extracted interactive element.
- `CapturePayload`: Structured response containing screenshot base64, element tree, count, and viewport dimensions.
- `CaptureResponse`: Status and error response contracts.

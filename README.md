# Vidur Monorepo

Vidur is an autonomous AI browser agent and privacy platform featuring a Manifest V3 Chrome Extension, local WebCrypto encrypted profile vault, AI reasoning engine (Claude 3.5 Sonnet), and real-time human-in-the-loop safety approvals.

---

## 📁 Repository Structure

```
vidur/
├── extension/            # Manifest V3 Chrome extension
│   ├── manifest.json     # Extension metadata, permissions & service worker
│   ├── background.js     # Background service worker & orchestration dispatcher
│   ├── content-script.js # Accessibility DOM tree extractor & element listener
│   ├── perception.js     # OCR perception layer (Tesseract.js integration)
│   ├── screen-schema.js  # Unified Screen Schema & IoU merge logic
│   ├── sanitizer.js      # Client-side Privacy Sanitizer (PII Redaction)
│   ├── vault.js          # WebCrypto Encrypted Profile Vault (AES-GCM + PBKDF2)
│   ├── executor.js       # Local Action Executor & Token Resolver
│   ├── orchestrator.js   # Autonomous Orchestration Loop (15 max iterations)
│   ├── popup/            # Extension popup UI
│   │   ├── popup.html    # Tabbed UI (Agent, Profile Vault, Screen Schema)
│   │   ├── popup.css     # Dark glassmorphic theme & live activity feed
│   │   └── popup.js      # Controller for loop lifecycle & vault security
│   ├── test-page/        # Local interactive test environments
│   │   ├── search-test.html  # Product search, filter, and checkout test page
│   │   └── login-test.html   # Authenticated form test page
│   ├── lib/              # Local vendored libraries (tesseract.min.js)
│   └── icons/            # Extension icons (16x16, 48x48, 128x128)
├── server/               # Node.js / Express backend
│   ├── src/
│   │   ├── index.js      # Express server entry point (Port 3000)
│   │   ├── routes/       # Route handlers (/health, /plan-action)
│   │   │   ├── health.js
│   │   │   └── planAction.js
│   │   └── services/     # AI services
│   │       └── reasoner.js # Claude 3.5 Sonnet / Heuristic action reasoning
│   ├── test/             # Automated unit and integration test suites
│   │   ├── plan-action.test.js
│   │   ├── executor.test.js
│   │   ├── orchestration-e2e.test.js
│   │   ├── sanitizer.test.js
│   │   └── screen-schema.test.js
│   ├── test-dom-extraction.js
│   ├── .env.example
│   └── package.json
├── shared/               # Universal schema definitions & types
│   ├── schema-types.ts
│   ├── screen-schema.js
│   └── sanitizer.js
├── .gitignore
└── README.md
```

---

## 🔄 Autonomous Orchestration Loop

Vidur runs an on-device orchestration cycle:

```mermaid
graph TD
    A[Capture Screen & DOM] --> B[Sanitize PII -> {{FIELD:TOKEN}}]
    B --> C[POST /plan-action to Reasoning Server]
    C --> D{Is Plan Done?}
    D -- Yes --> E[Task Complete 🎉]
    D -- No --> F{Is Action Sensitive?}
    F -- Yes: Submit / Pay / Delete --> G[Request Human Approval in Popup ⚠️]
    G --> H[User Approves]
    F -- No --> I[Resolve Tokens from Local Vault 🔐]
    H --> I
    I --> J[Execute Actions via chrome.scripting]
    J --> K[Wait Page to Settle]
    K --> A
```

- **Hard Iteration Limit**: Capped at **15 iterations** to prevent infinite loops.
- **Zero-Leak Cloud Defense**: Credentials and sensitive values are replaced with placeholder tokens (e.g. `{{FIELD:EMAIL_1}}`, `{{FIELD:PASSWORD_1}}`) before transmitting the screen schema to the LLM.
- **Human-in-the-Loop Safety**: Actions targeting `/submit|pay|confirm|delete|checkout/i` trigger an approval banner in the popup before execution.

---

## 🔐 Encrypted Profile Vault (`vault.js`)

- Uses the **WebCrypto SubtleCrypto API**:
  - **AES-GCM 256-bit** encryption.
  - **PBKDF2** key derivation (100,000 rounds of SHA-256 with a 16-byte random salt).
- **IndexedDB Storage**: Encrypted payload is saved in `VidurVaultDB`. The encryption key is derived on the fly from the user's passphrase and is **never stored in plaintext** or on disk.

---

## 🚀 Getting Started

### 1. Load the Chrome Extension

1. Open Google Chrome and go to `chrome://extensions`.
2. Enable **Developer mode** (toggle in the top-right).
3. Click **Load unpacked** and select the `vidur/extension` folder.
4. Pin **Vidur** to your browser toolbar.

---

---

### 2. Start the Backend Server

```bash
cd server
npm install
npm run dev
```

Server endpoints & playgrounds:
- Health check: `http://localhost:3000/health`
- Reasoning endpoint: `POST http://localhost:3000/plan-action`
- Product Search Test Page: `http://localhost:3000/test/search-test.html`
- Login Test Page: `http://localhost:3000/test/login-test.html`
- Enterprise Contact Test Page: `http://localhost:3000/test/contact-test.html`

---

### 3. Run the Autonomous Agent & Live Demo

1. Open any test page in Chrome (e.g. `http://localhost:3000/test/search-test.html`).
2. Open the **Vidur** extension (supports both Side Panel and Popup mode).
3. Choose from the **Task**, **Privacy**, or **Vault** tabs:
   - **Task Tab**: Select presets (`🔍 Search Headphones`, `🔑 Login Form`, `📝 Contact Form`), toggle **Demo Mode** if offline, and click **Start Autonomous Agent**.
   - **Privacy Tab**: Click **Capture & Inspect Privacy Schema** to inspect side-by-side Raw vs. Sanitized schema with highlighted `{{FIELD:TOKEN}}` tokens.
   - **Vault Tab**: Unlock the WebCrypto AES-GCM encrypted vault with your master passphrase.
   - **How It Works**: Click the **ℹ️** button in the header to view the 5-Stage Pipeline Modal with the Zero-Leak Privacy Boundary.

> 📖 **Live Presentation & Pitch Guide**: See [DEMO_SCRIPT.md](file:///c:/Users/kumar/Desktop/Vidur/DEMO_SCRIPT.md) for full step-by-step speaker notes, live demo scenarios, and pitch FAQs.

---

### 4. Run Automated Test Suites

```bash
cd server
npm test
```

Runs all 28 automated tests covering:
- Local Action Executor & Token Resolver (`test/executor.test.js`)
- End-to-End Orchestration Loop Simulation (`test/orchestration-e2e.test.js`)
- AI Action Planning & Validation (`test/plan-action.test.js`)
- Privacy Sanitizer & Luhn Algorithm (`test/sanitizer.test.js`)
- Screen Schema & IoU BBox Deduplication (`test/screen-schema.test.js`)
- DOM Tree Accessibility Extraction (`test-dom-extraction.js`)


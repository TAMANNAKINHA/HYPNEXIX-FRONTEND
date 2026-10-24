🛡️ AEGIS Frontend
Mission Wallets for Autonomous AI
Enterprise dashboard for governing AI payments.

---
🤔 Why AEGIS Exists
	
Traditional AI	Give the AI access to money and hope it behaves.
AEGIS	Give every task its own Mission Wallet with built-in rules.
Result	Even if the AI is compromised, the treasury isn't.
---
🧩 Where AEGIS Fits
Rails like AP2, Visa Intelligent Commerce, and Skyfire move the money. AEGIS is the console enterprises use to see, trust, and control what's happening — before they let an agent touch a rail at all.
---
🎨 The Experience
The dashboard lets enterprises:
🗣️ Create AI missions in plain language
💳 Visualize Mission Wallets
📊 Track payment lifecycle
🔐 Monitor security checks
🎯 Observe live attack simulations
📜 Review audit logs
🚨 Manage emergency controls
---
🖥️ Screens
Screen	
🗣️ Mission Console	Where every mission starts
💳 Mission Wallet	Budget, merchant, category, expiry — at a glance
🛡️ Security Engine	Every guard, visualized live
📡 Activity Feed	Human-readable, not developer logs
📜 Audit Trail	Full history, fully explainable
🚨 Emergency Controls	Freeze, cancel, terminate — one click

---
🧭 User Journey
```
User types
   ↓
Mission Created
   ↓
Wallet Generated
   ↓
Policies Attached
   ↓
Verification Selected
   ↓
Security Pipeline
   ↓
Payment Approved ✅   or   Blocked 🚫
```
---
🎯 Design Principles
🏢 Enterprise First
🔍 Explainable AI
🎛️ Minimal Decisions
📡 Real-time Transparency
🔒 Zero Trust
🗣️ Human Readable
---
🧱 Components
`Mission Console` · `Mission Wallet` · `Security Engine` · `Mission Passport` · `Activity Feed` · `Verification Timeline` · `Audit Trail` · `Emergency Controls`
---
📡 Live Updates
Every mission event streams over WebSocket — the dashboard never polls, never lags, never shows stale state.
---
🧰 Tech Stack
Layer	Tools
Framework	React, TypeScript
Styling	Tailwind
Motion	Framer Motion
Realtime	Socket.io
Build	Vite
---
📁 Folder Structure
```
frontend/
├── src/
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   └── lib/
└── README.md
```
---
🚀 Run
```bash
npm install
npm run dev
```
---
💡 Why It Matters
Traditional finance dashboards show what happened. AEGIS shows why, how, and whether it should have happened. That's the difference between a ledger and a governance system.
---
Every AI Needs a Mission. Every Mission Needs a Wallet. 🛡️

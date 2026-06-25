// src/main.tsx
// ── Silence Environmental App Check Errors ────────────────────────────────────
// These 403s come from the v0/Vercel environment (project: arcade-cf7d5)
// and are unrelated to the actual application logic.
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args) => {
    const msg = args[0]?.toString() || '';
    if (msg.includes('firebaseappcheck') && msg.includes('arcade-cf7d5')) return;
    originalError.apply(console, args);
  };
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // ← this imports Tailwind + your custom CSS
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
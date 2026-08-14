import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Register PWA Service Worker for Offline Capabilities & Installability
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('✅ CA Buddy PWA Service Worker registered:', reg.scope);
      })
      .catch((err) => {
        console.warn('PWA registration notice:', err);
      });
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)


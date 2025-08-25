import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Expand Telegram WebView on mobile
if ((window as any).Telegram && (window as any).Telegram.WebView && typeof (window as any).Telegram.expand === 'function') {
  (window as any).Telegram.WebView.expand();
}

createRoot(document.getElementById("root")!).render(<App />);

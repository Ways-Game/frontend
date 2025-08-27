import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/animations.css'

// Expand Telegram WebView on mobile
console.log("Expanding Telegram WebView", (window as any).Telegram.WebView);
if ((window as any).Telegram && (window as any).Telegram.WebView && typeof (window as any).Telegram.WebView.expand === 'function') {
  (window as any).Telegram.WebView.expand();
}

createRoot(document.getElementById("root")!).render(<App />);

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Remember scroll position across refreshes (the app's async first render
// makes the browser give up on restoring it on its own).
const SCROLL_KEY = "august-goals-scroll";
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
const saveScroll = () => {
  sessionStorage.setItem(SCROLL_KEY, String(window.scrollY || 0));
};
window.addEventListener("pagehide", saveScroll);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveScroll();
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

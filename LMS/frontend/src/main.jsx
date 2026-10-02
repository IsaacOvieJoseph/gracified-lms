import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Disable console logs in production
if (import.meta.env.PROD) {
  console.log = () => { };
  console.debug = () => { };
  console.info = () => { };
  console.warn = () => { };
  // We keep console.error for critical troubleshooting but you could empty it too if desired
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)


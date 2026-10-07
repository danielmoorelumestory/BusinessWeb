import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import '@fontsource/noto-serif-sc/600.css'
import '@fontsource/noto-serif-sc/700.css'
import './index.css'
import './styles/shell.css'
import './styles/report.css'

const root = createRoot(document.getElementById('root') as HTMLElement)
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

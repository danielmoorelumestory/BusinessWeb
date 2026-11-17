import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { scheduleChunkReload } from './components/ErrorBoundary'
import './index.css'
import './styles/shell.css'
import './styles/report.css'
import './styles/ui.css'

// Vite 预加载 chunk 失败（通常是部署后旧文件被删）：跨传播窗口递增重试拿新版本
window.addEventListener('vite:preloadError', (e) => {
  if (scheduleChunkReload()) e.preventDefault()
})

const root = createRoot(document.getElementById('root') as HTMLElement)
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

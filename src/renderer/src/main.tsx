import React from 'react'
import ReactDOM from 'react-dom/client'
import '@xterm/xterm/css/xterm.css'
import './styles.css'
import App from './App'
import { LauncherProvider } from './state/LauncherContext'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <LauncherProvider>
    <App />
  </LauncherProvider>
)

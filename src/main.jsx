import React from 'react'
import ReactDOM from 'react-dom/client'
import Cobra, { AppErrorBoundary } from '../cobra-game.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <Cobra />
    </AppErrorBoundary>
  </React.StrictMode>
)

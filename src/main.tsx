// Buffer polyfill – must be first
import { Buffer } from 'buffer'
;(globalThis as any).Buffer = Buffer

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

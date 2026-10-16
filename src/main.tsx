// Polyfills primero: iPadOS anteriores a 17.4 no traen Promise.withResolvers, structuredClone, Array.at, etc.
import 'core-js/actual'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const root = document.getElementById('root')!
root.setAttribute('data-ready', '1') // avisa al guardián de index.html que la app arrancó
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

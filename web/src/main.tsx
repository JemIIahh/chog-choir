import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initLook } from './lib/look'
import './styles.css'
import './structure.css'
import './looks/stage.css'
import './looks/poster.css'
import './looks/sorbet.css'

initLook()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

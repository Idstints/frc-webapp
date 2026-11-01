import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import App from './App'
import DevBlocker from './components/DevBlocker'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DevBlocker>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </DevBlocker>
  </StrictMode>,
)

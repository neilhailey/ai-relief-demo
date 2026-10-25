import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './app.css'
import App from './App'
import { ProjectsGallery } from './pages/ProjectsGallery'
import { ProjectDetail } from './pages/ProjectDetail'
import { UploadWizard } from './pages/UploadWizard'
import { LanguageProvider } from './contexts/LanguageContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider } from './contexts/AuthContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <ThemeProvider>
          <AuthProvider>
            <Routes>
              <Route path="/"              element={<ProjectsGallery />} />
              <Route path="/create"        element={<App />} />
              <Route path="/projects/new"  element={<UploadWizard />} />
              <Route path="/projects/:id"  element={<ProjectDetail />} />
            </Routes>
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>
)

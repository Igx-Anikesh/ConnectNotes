import { useRef, useState, useCallback, useEffect } from 'react'
import type { CanvasBackgroundMode, ToolType } from '@draftboard/shared'
import { TopNav } from './components/TopNav'
import { Toolbar } from './components/Toolbar'
import { BottomBar } from './components/BottomBar'
import { AgentLog } from './components/AgentLog'
import { ZoomControls } from './components/ZoomControls'
import { SidePanel } from './components/SidePanel'
import { AuthPage } from './components/AuthPage'
import type { Project } from './components/SidePanel'
import { useCanvas } from './hooks/useCanvas'
import { useTools } from './hooks/useTools'
import { useAuth } from './hooks/useAuth'

export type AppTheme = 'dark' | 'light' | 'custom'

// Canvas wrapper with its own ref — ensures clean re-init on key change
function CanvasArea({ activeTool, drawSettings, bgMode, toolClass, children }: {
  activeTool: ToolType
  drawSettings: DrawingSettings
  bgMode: CanvasBackgroundMode
  toolClass: string
  children: (canvas: ReturnType<typeof useCanvas>) => React.ReactNode
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvas = useCanvas(containerRef, { activeTool, drawSettings })
  const zoomScale = canvas.zoom / 100

  const bgStyle: React.CSSProperties = {
    backgroundPosition: `${canvas.vpX}px ${canvas.vpY}px`,
    backgroundSize:
      bgMode === 'dots'
        ? `${20 * zoomScale}px ${20 * zoomScale}px`
        : bgMode === 'grid'
          ? `${40 * zoomScale}px ${40 * zoomScale}px`
          : undefined,
  }

  return (
    <div className={`canvas-area ${toolClass}${canvas.isPanning ? ' panning' : ''}`} id="canvas-area">
      <div className={`canvas-bg canvas-bg--${bgMode}`} style={bgStyle} />
      <div className="canvas-particles" aria-hidden="true">
        {Array.from({ length: 20 }).map((_, i) => (
          <span key={i} className="particle" style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 12}s`,
            animationDuration: `${8 + Math.random() * 12}s`,
          }} />
        ))}
      </div>
      <div
        ref={containerRef}
        id="canvas-container"
        style={{ position: 'absolute', inset: 0, zIndex: 1 }}
      />
      {children(canvas)}
    </div>
  )
}

export interface DrawingSettings {
  strokeColor: string
  fillColor: string
  strokeWidth: number
  opacity: number
  fontFamily: string
  fontSize: number
}

const DRAWING_TOOLS = [
  'rect', 'ellipse', 'triangle', 'line', 'arrow', 
  'pen', 'brush', 'highlighter', 'spray', 'circle_brush',
  'eraser', 'sticky'
]

const SESSION_DURATION = 30 * 60 * 1000 // 30 minutes
const PROJECTS_KEY = 'draftboard_projects'

function getOrCreateProject(): Project {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY)
    if (raw) {
      const projects: Project[] = JSON.parse(raw)
      if (projects.length > 0) {
        // Find most recently updated
        const sorted = [...projects].sort((a, b) => b.updatedAt - a.updatedAt)
        return sorted[0]
      }
    }
  } catch { /* ignore */ }

  // Create default project
  const project: Project = {
    id: Date.now().toString(36) + Math.random().toString(36).substring(2),
    name: 'The Blank Slate',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    canvasData: null,
  }
  localStorage.setItem(PROJECTS_KEY, JSON.stringify([project]))
  return project
}

export default function App() {
  const [bgMode, setBgMode] = useState<CanvasBackgroundMode>('dots')
  const { activeTool, selectTool } = useTools()
  const [sessionExpired, setSessionExpired] = useState(false)
  const [sidePanelOpen, setSidePanelOpen] = useState(false)
  const [currentProject, setCurrentProject] = useState<Project>(getOrCreateProject)
  const [projectKey, setProjectKey] = useState(0)
  const [showAuth, setShowAuth] = useState(false)
  const { user, sendOtp, verifyOtp, updateProfile } = useAuth()

  const [theme, setTheme] = useState<AppTheme>(() => localStorage.getItem('draftboard_theme') as AppTheme || 'dark')
  const [customColor, setCustomColor] = useState(() => localStorage.getItem('draftboard_customColor') || '#fff8e7')

  useEffect(() => {
    localStorage.setItem('draftboard_theme', theme)
    if (theme === 'dark') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', theme)
    }
  }, [theme])

  useEffect(() => {
    localStorage.setItem('draftboard_customColor', customColor)
    if (theme === 'custom') {
      document.documentElement.style.setProperty('--custom-canvas-bg', customColor)
    } else {
      document.documentElement.style.removeProperty('--custom-canvas-bg')
    }
  }, [customColor, theme])

  const [drawSettings, setDrawSettings] = useState<DrawingSettings>(() => {
    try {
      const saved = localStorage.getItem('draftboard_drawSettings')
      if (saved) return JSON.parse(saved)
    } catch { /* ignore */ }
    return {
      strokeColor: '#e8e8e8',
      fillColor: 'transparent',
      strokeWidth: 2,
      opacity: 1,
      fontFamily: "'Just Another Hand', cursive",
      fontSize: 32,
    }
  })

  useEffect(() => {
    localStorage.setItem('draftboard_drawSettings', JSON.stringify(drawSettings))
  }, [drawSettings])

  // Session timer
  useEffect(() => {
    const startKey = 'draftboard_sessionStart'
    const existing = localStorage.getItem(startKey)
    const now = Date.now()
    
    if (!existing) {
      localStorage.setItem(startKey, now.toString())
    } else {
      const elapsed = now - parseInt(existing, 10)
      if (elapsed >= SESSION_DURATION) {
        setSessionExpired(true)
        return
      }
    }

    const remaining = existing 
      ? SESSION_DURATION - (now - parseInt(existing, 10))
      : SESSION_DURATION

    const timer = setTimeout(() => {
      setSessionExpired(true)
    }, Math.max(remaining, 0))

    return () => clearTimeout(timer)
  }, [])

  const handleResetSession = useCallback(() => {
    localStorage.setItem('draftboard_sessionStart', Date.now().toString())
    setSessionExpired(false)
  }, [])

  const handleMenuToggle = useCallback(() => {
    setSidePanelOpen(prev => !prev)
  }, [])

  const handleSwitchProject = useCallback((project: Project) => {
    try {
      const currentCanvas = localStorage.getItem('draftboard_canvas')
      if (currentCanvas) {
        const projects: Project[] = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]')
        const idx = projects.findIndex(p => p.id === currentProject.id)
        if (idx >= 0) {
          projects[idx].canvasData = currentCanvas
          projects[idx].updatedAt = Date.now()
          localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects))
        }
      }
    } catch { /* ignore */ }

    if (project.canvasData) {
      localStorage.setItem('draftboard_canvas', project.canvasData)
    } else {
      localStorage.removeItem('draftboard_canvas')
    }

    setCurrentProject(project)
    setProjectKey(k => k + 1)
  }, [currentProject.id])

  const handleNewProject = useCallback(() => {
    try {
      const currentCanvas = localStorage.getItem('draftboard_canvas')
      const projects: Project[] = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]')
      const idx = projects.findIndex(p => p.id === currentProject.id)
      if (idx >= 0 && currentCanvas) {
        projects[idx].canvasData = currentCanvas
        projects[idx].updatedAt = Date.now()
      }

      const newProject: Project = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2),
        name: `Project ${projects.length + 1}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        canvasData: null,
      }
      projects.push(newProject)
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects))

      localStorage.removeItem('draftboard_canvas')
      setCurrentProject(newProject)
      setProjectKey(k => k + 1)
      setSidePanelOpen(false)
    } catch { /* ignore */ }
  }, [currentProject.id])

  const handleProjectNameChange = useCallback((name: string) => {
    setCurrentProject(prev => {
      const updated = { ...prev, name, updatedAt: Date.now() }
      try {
        const projects: Project[] = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]')
        const idx = projects.findIndex(p => p.id === prev.id)
        if (idx >= 0) {
          projects[idx].name = name
          projects[idx].updatedAt = Date.now()
          localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects))
        }
      } catch { /* ignore */ }
      return updated
    })
  }, [])

  const isDrawingMode = DRAWING_TOOLS.includes(activeTool)

  // Session expired overlay
  if (sessionExpired) {
    return (
      <div className="session-expired-overlay">
        <div className="session-expired-card">
          <div className="session-icon">⏱</div>
          <h2>Session Expired</h2>
          <p>Your 30-minute temporary session has ended. Your work has been saved locally.</p>
          <p className="session-hint">Sign in to save your work permanently, or continue as a guest.</p>
          <div className="session-actions">
            <button className="session-btn session-btn--primary" onClick={handleResetSession}>
              Continue as Guest
            </button>
            <button className="session-btn session-btn--secondary" onClick={() => { setSessionExpired(false); setShowAuth(true); }}>
              Sign In
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-layout">
      {/* Side Panel */}
      <SidePanel
        isOpen={sidePanelOpen}
        onClose={() => setSidePanelOpen(false)}
        currentProjectId={currentProject.id}
        onSwitchProject={handleSwitchProject}
        onNewProject={handleNewProject}
        theme={theme}
        onThemeChange={setTheme}
        customColor={customColor}
        onCustomColorChange={setCustomColor}
        onShowAuth={() => setShowAuth(true)}
        user={user}
      />

      {showAuth && (
        <AuthPage 
          onClose={() => setShowAuth(false)} 
          onComplete={() => setShowAuth(false)} 
          sendOtp={sendOtp}
          verifyOtp={verifyOtp}
          updateProfile={updateProfile}
        />
      )}

      {/* Canvas — key forces full remount on project switch */}
      <CanvasArea
        key={projectKey}
        activeTool={activeTool}
        drawSettings={drawSettings}
        bgMode={bgMode}
        toolClass={`tool-${activeTool}`}
      >
        {(canvas) => (
          <>
            {/* UI overlays */}
            <TopNav
              onExport={() => canvas.exportCanvas()}
              onShare={() => canvas.shareCanvas()}
              onMenuToggle={handleMenuToggle}
              projectName={currentProject.name}
              onProjectNameChange={handleProjectNameChange}
            />
            <Toolbar 
              activeTool={activeTool} 
              onSelectTool={selectTool}
              onUndo={() => canvas.undo()}
              onRedo={() => canvas.redo()}
              canUndo={canvas.canUndo}
              canRedo={canvas.canRedo}
            />
            <BottomBar
              isDrawingMode={isDrawingMode}
              activeTool={activeTool}
              drawSettings={drawSettings}
              onDrawSettingsChange={setDrawSettings}
            />
            <ZoomControls
              zoom={canvas.zoom}
              bgMode={bgMode}
              onZoomIn={() => canvas.setZoom(Math.min(canvas.zoom + 10, 500))}
              onZoomOut={() => canvas.setZoom(Math.max(canvas.zoom - 10, 25))}
              onResetZoom={() => canvas.resetView()}
              onBgModeChange={setBgMode}
            />
          </>
        )}
      </CanvasArea>
    </div>
  )
}

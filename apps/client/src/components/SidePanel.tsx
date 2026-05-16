import { useState, useEffect, useRef } from 'react'
import { AgentLog } from './AgentLog'

export interface Project {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  canvasData: string | null
}

export interface Meeting {
  id: string
  title: string
  scheduledAt: number
  status: 'scheduled' | 'live' | 'ended'
  participants: string[]
}

interface SidePanelProps {
  isOpen: boolean
  onClose: () => void
  currentProjectId: string
  onSwitchProject: (project: Project) => void
  onNewProject: () => void
  theme: 'dark' | 'light' | 'custom'
  onThemeChange: (theme: 'dark' | 'light' | 'custom') => void
  customColor: string
  onCustomColorChange: (color: string) => void
  onShowAuth: () => void
  user: { id: string } | null
}

const PROJECTS_KEY = 'draftboard_projects'
const MEETINGS_KEY = 'draftboard_meetings'

function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return []
}

function saveProjects(projects: Project[]) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects))
}

function loadMeetings(): Meeting[] {
  try {
    const raw = localStorage.getItem(MEETINGS_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return []
}

function saveMeetings(meetings: Meeting[]) {
  localStorage.setItem(MEETINGS_KEY, JSON.stringify(meetings))
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function SidePanel({
  isOpen, onClose, currentProjectId, onSwitchProject, onNewProject,
  theme, onThemeChange, customColor, onCustomColorChange,
  onShowAuth, user
}: SidePanelProps) {
  const [projects, setProjects] = useState<Project[]>(loadProjects)
  const [meetings, setMeetings] = useState<Meeting[]>(loadMeetings)
  const [activeTab, setActiveTab] = useState<'projects' | 'meetings'>('projects')
  const [showTheme, setShowTheme] = useState(false)
  const [showNewMeeting, setShowNewMeeting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const meetingTitleRef = useRef<HTMLInputElement>(null)
  const meetingDateRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  const handleDeleteProject = (id: string) => {
    if (id === currentProjectId) return // can't delete active
    const next = projects.filter(p => p.id !== id)
    setProjects(next)
    saveProjects(next)
    // Clean up its canvas data
    localStorage.removeItem(`draftboard_canvas_${id}`)
  }

  const handleRenameProject = (id: string, newName: string) => {
    const next = projects.map(p => p.id === id ? { ...p, name: newName.trim() || p.name, updatedAt: Date.now() } : p)
    setProjects(next)
    saveProjects(next)
    setEditingId(null)
  }

  const handleScheduleMeeting = () => {
    const title = meetingTitleRef.current?.value?.trim()
    const date = meetingDateRef.current?.value
    if (!title || !date) return

    const meeting: Meeting = {
      id: (Date.now().toString(36) + Math.random().toString(36).substring(2)),
      title,
      scheduledAt: new Date(date).getTime(),
      status: 'scheduled',
      participants: ['You'],
    }
    const next = [...meetings, meeting]
    setMeetings(next)
    saveMeetings(next)
    setShowNewMeeting(false)
  }

  const handleDeleteMeeting = (id: string) => {
    const next = meetings.filter(m => m.id !== id)
    setMeetings(next)
    saveMeetings(next)
  }

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <>
      {/* Backdrop */}
      <div className={`sidepanel-backdrop ${isOpen ? 'open' : ''}`} onClick={onClose} />

      {/* Panel */}
      <aside className={`sidepanel ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="sidepanel-header">
          <h2 className="sidepanel-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            DraftBoard
          </h2>
          <button className="sidepanel-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="sidepanel-tabs">
          <button
            className={`sidepanel-tab ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveTab('projects')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            Projects
          </button>
          <button
            className={`sidepanel-tab ${activeTab === 'meetings' ? 'active' : ''}`}
            onClick={() => setActiveTab('meetings')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Meetings
          </button>

        </div>

        {/* Content */}
        <div className="sidepanel-content">
          {activeTab === 'projects' ? (
            <>
              {/* New Project Button */}
              <button className="sidepanel-action-btn" onClick={onNewProject}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New Project
              </button>

              {/* Project List */}
              <div className="sidepanel-list">
                {projects.length === 0 ? (
                  <div className="sidepanel-empty">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    <p>No projects yet</p>
                    <span>Create your first project to get started</span>
                  </div>
                ) : (
                  projects.sort((a, b) => b.updatedAt - a.updatedAt).map(project => (
                    <div
                      key={project.id}
                      className={`sidepanel-item ${project.id === currentProjectId ? 'active' : ''}`}
                    >
                      <div
                        className="sidepanel-item-main"
                        onClick={() => { onSwitchProject(project); onClose(); }}
                      >
                        <div className="sidepanel-item-icon">
                          {project.id === currentProjectId ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="6" />
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="3" width="18" height="18" rx="3" />
                            </svg>
                          )}
                        </div>
                        <div className="sidepanel-item-info">
                          {editingId === project.id ? (
                            <input
                              ref={editInputRef}
                              className="sidepanel-rename-input"
                              defaultValue={project.name}
                              onBlur={(e) => handleRenameProject(project.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameProject(project.id, (e.target as HTMLInputElement).value)
                                if (e.key === 'Escape') setEditingId(null)
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span className="sidepanel-item-name">{project.name}</span>
                          )}
                          <span className="sidepanel-item-meta">{timeAgo(project.updatedAt)}</span>
                        </div>
                      </div>
                      <div className="sidepanel-item-actions">
                        <button
                          className="sidepanel-item-btn"
                          title="Rename"
                          onClick={(e) => { e.stopPropagation(); setEditingId(project.id); }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        {project.id !== currentProjectId && (
                          <button
                            className="sidepanel-item-btn danger"
                            title="Delete"
                            onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : activeTab === 'meetings' ? (
            <>
              {/* New Meeting Button */}
              <button className="sidepanel-action-btn meeting" onClick={() => setShowNewMeeting(!showNewMeeting)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Schedule Meeting
              </button>

              {/* New Meeting Form */}
              {showNewMeeting && (
                <div className="sidepanel-form">
                  <input
                    ref={meetingTitleRef}
                    type="text"
                    placeholder="Meeting title..."
                    className="sidepanel-input"
                  />
                  <input
                    ref={meetingDateRef}
                    type="datetime-local"
                    className="sidepanel-input"
                  />
                  <div className="sidepanel-form-actions">
                    <button className="sidepanel-form-btn cancel" onClick={() => setShowNewMeeting(false)}>
                      Cancel
                    </button>
                    <button className="sidepanel-form-btn confirm" onClick={handleScheduleMeeting}>
                      Schedule
                    </button>
                  </div>
                </div>
              )}

              {/* Meetings List */}
              <div className="sidepanel-list">
                {meetings.length === 0 && !showNewMeeting ? (
                  <div className="sidepanel-empty">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <p>No meetings scheduled</p>
                    <span>Schedule a live session to collaborate in real-time</span>
                  </div>
                ) : (
                  meetings.sort((a, b) => a.scheduledAt - b.scheduledAt).map(meeting => {
                    const isPast = meeting.scheduledAt < Date.now()
                    const isToday = new Date(meeting.scheduledAt).toDateString() === new Date().toDateString()
                    return (
                      <div key={meeting.id} className={`sidepanel-item meeting-item ${isPast ? 'past' : ''}`}>
                        <div className="sidepanel-item-main">
                          <div className={`meeting-status-dot ${isPast ? 'ended' : isToday ? 'today' : 'upcoming'}`} />
                          <div className="sidepanel-item-info">
                            <span className="sidepanel-item-name">{meeting.title}</span>
                            <span className="sidepanel-item-meta">
                              {formatDate(meeting.scheduledAt)}
                              {isToday && !isPast && <span className="meeting-badge">Today</span>}
                            </span>
                          </div>
                        </div>
                        <div className="sidepanel-item-actions">
                          {!isPast && (
                            <button className="sidepanel-item-btn join" title="Join">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polygon points="5 3 19 12 5 21 5 3" />
                              </svg>
                            </button>
                          )}
                          <button
                            className="sidepanel-item-btn danger"
                            title="Delete"
                            onClick={() => handleDeleteMeeting(meeting.id)}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="sidepanel-footer">
          {showTheme && (
            <div className="footer-theme-panel">
              <div className="theme-options">
                <button
                  className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                  onClick={() => onThemeChange('dark')}
                >
                  <div className="theme-preview dark"></div>
                  <span>Dark</span>
                </button>
                <button
                  className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                  onClick={() => onThemeChange('light')}
                >
                  <div className="theme-preview light"></div>
                  <span>Light</span>
                </button>
                <button
                  className={`theme-btn ${theme === 'custom' ? 'active' : ''}`}
                  onClick={() => onThemeChange('custom')}
                >
                  <div className="theme-preview custom" style={{ background: theme === 'custom' ? customColor : '#fff8e7' }}></div>
                  <span>Custom</span>
                </button>
              </div>
              {theme === 'custom' && (
                <div className="custom-color-picker">
                  <label htmlFor="customBgColor">Canvas Color</label>
                  <div className="color-input-wrapper">
                    <input
                      type="color"
                      id="customBgColor"
                      value={customColor}
                      onChange={(e) => onCustomColorChange(e.target.value)}
                    />
                    <span className="color-hex">{customColor.toUpperCase()}</span>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div style={{ marginBottom: '16px' }}>
            <AgentLog />
          </div>

          <div className="sidepanel-footer-row">
            <div className="sidepanel-footer-user" onClick={!user ? () => { onShowAuth(); onClose(); } : undefined} style={{ cursor: !user ? 'pointer' : 'default' }}>
              <div className="sidepanel-avatar">{user ? user.id[0].toUpperCase() : 'G'}</div>
              <div className="sidepanel-footer-info">
                <span className="sidepanel-footer-name">{user ? user.id : 'Guest User'}</span>
                <span className="sidepanel-footer-role" style={{ color: !user ? 'var(--accent-blue)' : undefined }}>
                  {user ? 'Pro Plan' : 'Sign In / Register'}
                </span>
              </div>
            </div>
            <button className="footer-settings-btn" onClick={() => setShowTheme(p => !p)} title="Theme Settings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

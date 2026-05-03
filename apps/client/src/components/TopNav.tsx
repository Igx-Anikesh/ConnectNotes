import { useRef } from 'react'

interface TopNavProps {
  onExport: () => void
  onShare: () => void
  onMenuToggle: () => void
  projectName: string
  onProjectNameChange: (name: string) => void
}

export function TopNav({ onExport, onShare, onMenuToggle, projectName, onProjectNameChange }: TopNavProps) {
  const titleRef = useRef<HTMLInputElement>(null)

  return (
    <header className="topnav">
      <div className="topnav-left">
        <button className="nav-btn icon-only" id="menu-btn" aria-label="Menu" onClick={onMenuToggle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <input
          ref={titleRef}
          className="board-title"
          id="board-title"
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
          type="text"
          spellCheck={false}
        />
      </div>
      <div className="topnav-right">
        <button className="nav-btn" id="export-btn" onClick={onExport}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export
        </button>
        <button className="nav-btn" id="share-btn" onClick={onShare}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share
        </button>
        <div className="user-avatar" id="user-avatar" title="Guest User">
          G
        </div>
      </div>
    </header>
  )
}

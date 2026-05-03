"use client";

import { useState, useEffect, useRef } from 'react'
import type { DrawingSettings } from '../App'

interface BottomBarProps {
  isDrawingMode: boolean
  activeTool: string
  drawSettings: DrawingSettings
  onDrawSettingsChange: (s: DrawingSettings) => void
}

const QUICK_COLORS = [
  '#e8e8e8',  // white-ish
  '#4a9eff',  // blue
  '#34d399',  // green
  '#f59e0b',  // amber
  '#ef4444',  // red
]

const STROKE_WIDTHS = [1, 2, 4, 8, 12]

const FONT_OPTIONS = [
  { id: "'Playwrite AR', cursive", label: "Playwrite" },
  { id: "'Just Another Hand', cursive", label: "Just Another Hand" },
  { id: "'Caveat', cursive", label: "Caveat" },
  { id: "'Kalam', cursive", label: "Kalam" },
  { id: "'Inter', sans-serif", label: "Inter" },
  { id: "'Roboto', sans-serif", label: "Roboto" },
  { id: "'Outfit', sans-serif", label: "Outfit" },
]

const FONT_SIZES = [16, 24, 32, 48, 64]

export function BottomBar({ isDrawingMode, activeTool, drawSettings, onDrawSettingsChange }: BottomBarProps) {
  const [showPrompt, setShowPrompt] = useState(false)
  const colorInputRef = useRef<HTMLInputElement>(null)
  
  const isTextMode = activeTool === 'text'
  const isDrawOrTextMode = isDrawingMode || isTextMode

  useEffect(() => {
    setShowPrompt(false)
  }, [isDrawOrTextMode, activeTool])

  const showingPrompt = !isDrawOrTextMode || showPrompt

  if (showingPrompt) {
    return (
      <div className="bottombar" id="bottombar">
        <div className="prompt-container">
          <input
            className="prompt-input"
            id="prompt-input"
            type="text"
            placeholder="What would you like to change or create?"
            spellCheck={false}
          />
          <div className="prompt-actions">
            <button className="action-btn" id="add-attachment-btn" title="Add attachment">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <button className="action-btn" id="expand-btn" title="Expand">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          </div>
        </div>
        <div className="action-controls">
          {isDrawOrTextMode && (
            <button
              className="action-btn"
              title="Show tools"
              onClick={() => setShowPrompt(false)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
                <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
                <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
                <circle cx="6.5" cy="12" r="0.5" fill="currentColor" />
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
              </svg>
            </button>
          )}
          <button className="action-btn" id="emoji-btn" title="Emoji">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </button>
          <button className="model-selector" id="model-selector">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            DraftBoard
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <button className="action-btn send" id="send-btn" title="Send">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  // Check if the current color is a custom one (not in the quick palette)
  const isCustomColor = !QUICK_COLORS.includes(drawSettings.strokeColor)

  // ─── Drawing Tools Mode ───
  return (
    <div className="bottombar" id="bottombar">
      <div className="draw-tools-container">
        {/* 5 quick colors + custom picker */}
        <div className="draw-section">
          <span className="draw-label">Color</span>
          <div className="color-palette">
            {QUICK_COLORS.map((color) => (
              <button
                key={color}
                className={`color-swatch ${drawSettings.strokeColor === color ? 'active' : ''}`}
                style={{ '--swatch-color': color } as React.CSSProperties}
                onClick={() => onDrawSettingsChange({ ...drawSettings, strokeColor: color })}
                title={color}
              />
            ))}
            {/* Custom color picker */}
            <button
              className={`color-swatch color-swatch--custom ${isCustomColor ? 'active' : ''}`}
              style={{ '--swatch-color': isCustomColor ? drawSettings.strokeColor : '#888' } as React.CSSProperties}
              onClick={() => colorInputRef.current?.click()}
              title="Custom color"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <input
              ref={colorInputRef}
              type="color"
              value={isCustomColor ? drawSettings.strokeColor : '#888888'}
              onChange={(e) => onDrawSettingsChange({ ...drawSettings, strokeColor: e.target.value })}
              className="color-picker-hidden"
            />
          </div>
        </div>

        <div className="draw-divider" />

        {/* Dynamic section: Text properties or Shape/Pen properties */}
        {isTextMode ? (
          <>
            {/* Font selector */}
            <div className="draw-section">
              <span className="draw-label">Font</span>
              <select
                className="font-select"
                value={drawSettings.fontFamily}
                onChange={(e) => onDrawSettingsChange({ ...drawSettings, fontFamily: e.target.value })}
                style={{ fontFamily: drawSettings.fontFamily }}
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.id} value={f.id} style={{ fontFamily: f.id }}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="draw-divider" />

            {/* Font size */}
            <div className="draw-section">
              <span className="draw-label">Size</span>
              <select
                className="font-select"
                value={drawSettings.fontSize}
                onChange={(e) => onDrawSettingsChange({ ...drawSettings, fontSize: Number(e.target.value) })}
              >
                {FONT_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}px
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <>
            {/* Fill toggle */}
            <div className="draw-section">
              <span className="draw-label">Fill</span>
              <div className="fill-options">
                <button
                  className={`fill-btn ${drawSettings.fillColor === 'transparent' ? 'active' : ''}`}
                  onClick={() => onDrawSettingsChange({ ...drawSettings, fillColor: 'transparent' })}
                  title="No fill"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="3" y1="21" x2="21" y2="3" />
                  </svg>
                </button>
                <button
                  className={`fill-btn ${drawSettings.fillColor !== 'transparent' ? 'active' : ''}`}
                  onClick={() => onDrawSettingsChange({ ...drawSettings, fillColor: drawSettings.strokeColor + '33' })}
                  title="Filled"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="draw-divider" />

            {/* Stroke width with numbers */}
            <div className="draw-section">
              <span className="draw-label">Size</span>
              <div className="stroke-options">
                {STROKE_WIDTHS.map((w) => (
                  <button
                    key={w}
                    className={`stroke-btn ${drawSettings.strokeWidth === w ? 'active' : ''}`}
                    onClick={() => onDrawSettingsChange({ ...drawSettings, strokeWidth: w })}
                    title={`${w}px`}
                  >
                    <span className="stroke-num">{w}</span>
                    <span
                      className="stroke-preview"
                      style={{ height: Math.max(w, 1), width: '100%', backgroundColor: drawSettings.strokeColor }}
                    />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="draw-divider" />

        {/* Switch back to prompt */}
        <button
          className="draw-prompt-toggle"
          onClick={() => setShowPrompt(true)}
          title="Show prompt"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>
    </div>
  )
}

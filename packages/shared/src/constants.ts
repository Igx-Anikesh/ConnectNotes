import type { ToolType } from './types';

export const TOOL_DEFINITIONS: { id: ToolType; label: string; icon: string; shortcut: string }[] = [
  { id: 'select',   label: 'Select',    icon: 'cursor',   shortcut: 'V' },
  { id: 'rect',     label: 'Rectangle', icon: 'square',   shortcut: 'R' },
  { id: 'ellipse',  label: 'Ellipse',   icon: 'circle',   shortcut: 'O' },
  { id: 'line',     label: 'Line',      icon: 'line',     shortcut: 'L' },
  { id: 'arrow',    label: 'Arrow',     icon: 'arrow',    shortcut: 'A' },
  { id: 'pen',      label: 'Draw',      icon: 'pen',      shortcut: 'P' },
  { id: 'text',     label: 'Text',      icon: 'type',     shortcut: 'T' },
  { id: 'pan',      label: 'Pan',       icon: 'grab',     shortcut: 'H' },
  { id: 'sticky',   label: 'Sticky',    icon: 'sticky',   shortcut: 'S' },
  { id: 'eraser',   label: 'Eraser',    icon: 'eraser',   shortcut: 'E' },
];

export const COLORS = {
  // Canvas
  canvasBg: '#0d0d0d',
  canvasBgAlt: '#111111',
  
  // UI surfaces
  surfacePrimary: '#1a1a1a',
  surfaceSecondary: '#222222',
  surfaceHover: '#2a2a2a',
  surfaceActive: '#333333',
  
  // Borders
  borderSubtle: 'rgba(255, 255, 255, 0.06)',
  borderDefault: 'rgba(255, 255, 255, 0.1)',
  borderHover: 'rgba(255, 255, 255, 0.15)',
  
  // Text
  textPrimary: '#e8e8e8',
  textSecondary: '#888888',
  textMuted: '#555555',
  
  // Accents
  accentBlue: '#4a9eff',
  accentGreen: '#34d399',
  accentOrange: '#f59e0b',
  accentRed: '#ef4444',
  accentPurple: '#a78bfa',
  
  // Grid
  dotColor: 'rgba(255, 255, 255, 0.08)',
  gridColor: 'rgba(255, 255, 255, 0.06)',
};

export const GRID = {
  dotSpacing: 20,
  dotRadius: 1,
  gridSpacing: 40,
  gridLineWidth: 0.5,
};

export const TRIAL = {
  durationMs: 15 * 60 * 1000, // 15 minutes
  draftTtlMs: 24 * 60 * 60 * 1000, // 24 hours
  storageKeys: {
    trialStart: 'draftboard_trial_start',
    trialStatus: 'draftboard_trial_status',
    guestDraft: 'draftboard_guest_draft',
    draftExpires: 'draftboard_draft_expires',
    guestToken: 'draftboard_guest_token',
  },
};

// Default shape styles
export const DEFAULTS = {
  fill: 'transparent',
  stroke: '#e8e8e8',
  strokeWidth: 2,
  opacity: 1,
  fontSize: 18,
  fontFamily: "'Inter', sans-serif",
};

// User presence colors (assigned round-robin)
export const PRESENCE_COLORS = [
  '#4a9eff', '#34d399', '#f59e0b', '#ef4444', '#a78bfa',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

"use client";

import { useState, useRef, useEffect } from "react";
import type { ToolType } from "@draftboard/shared";

interface ToolbarProps {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
}

type ToolOption = { id: ToolType; label: string; icon: React.ReactNode };

const PEN_TOOLS: ToolOption[] = [
  { id: "pen", label: "Pen", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" /></svg> },
  { id: "brush", label: "Painting Brush", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg> },
  { id: "highlighter", label: "Highlighter", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" /><line x1="16" y1="8" x2="2" y2="22" /><line x1="17.5" y1="15" x2="9" y2="6.5" /></svg> },
];

const SHAPE_TOOLS: ToolOption[] = [
  { id: "rect", label: "Rectangle", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /></svg> },
  { id: "ellipse", label: "Circle", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /></svg> },
  { id: "triangle", label: "Triangle", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></svg> },
  { id: "line", label: "Line", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="19" x2="19" y2="5" /></svg> },
  { id: "arrow", label: "Arrow", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg> },
];

export function Toolbar({ activeTool, onSelectTool }: ToolbarProps) {
  const [flyoutOpen, setFlyoutOpen] = useState<"pen" | "shapes" | null>(null);
  
  // Track last used tool in each group so clicking the main button reselects it
  const [activePenTool, setActivePenTool] = useState<ToolType>("pen");
  const [activeShapeTool, setActiveShapeTool] = useState<ToolType>("rect");

  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setFlyoutOpen(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleGroupClick = (group: "pen" | "shapes", lastTool: ToolType) => {
    if (flyoutOpen === group) {
      setFlyoutOpen(null);
    } else {
      if (activeTool !== lastTool) {
        onSelectTool(lastTool);
      }
      setFlyoutOpen(group);
    }
  };

  const handleSubtoolSelect = (group: "pen" | "shapes", toolId: ToolType) => {
    if (group === "pen") setActivePenTool(toolId);
    if (group === "shapes") setActiveShapeTool(toolId);
    onSelectTool(toolId);
    setFlyoutOpen(null);
  };

  const isPenGroupActive = PEN_TOOLS.some((t) => t.id === activeTool);
  const isShapeGroupActive = SHAPE_TOOLS.some((t) => t.id === activeTool);

  const currentPen = PEN_TOOLS.find((t) => t.id === activePenTool) || PEN_TOOLS[0];
  const currentShape = SHAPE_TOOLS.find((t) => t.id === activeShapeTool) || SHAPE_TOOLS[0];

  return (
    <div className="toolbar" id="toolbar" ref={toolbarRef}>
      {/* Select */}
      <button
        className={`toolbar-btn ${activeTool === "select" ? "active" : ""}`}
        data-tooltip="Select (V)"
        onClick={() => { onSelectTool("select"); setFlyoutOpen(null); }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /><path d="M13 13l6 6" /></svg>
      </button>

      {/* Pen Group */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${isPenGroupActive ? "active" : ""}`}
          data-tooltip="Pen (P)"
          onClick={() => handleGroupClick("pen", activePenTool)}
        >
          {currentPen.icon}
        </button>
        {flyoutOpen === "pen" && (
          <div className="toolbar-flyout">
            {PEN_TOOLS.map((tool) => (
              <button
                key={tool.id}
                className={`flyout-btn ${activeTool === tool.id ? "active" : ""}`}
                onClick={() => handleSubtoolSelect("pen", tool.id)}
                title={tool.label}
              >
                {tool.icon}
                <span className="flyout-label">{tool.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Shapes Group */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${isShapeGroupActive ? "active" : ""}`}
          data-tooltip="Shapes (R)"
          onClick={() => handleGroupClick("shapes", activeShapeTool)}
        >
          {currentShape.icon}
        </button>
        {flyoutOpen === "shapes" && (
          <div className="toolbar-flyout">
            {SHAPE_TOOLS.map((tool) => (
              <button
                key={tool.id}
                className={`flyout-btn ${activeTool === tool.id ? "active" : ""}`}
                onClick={() => handleSubtoolSelect("shapes", tool.id)}
                title={tool.label}
              >
                {tool.icon}
                <span className="flyout-label">{tool.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pan (Hand) */}
      <button
        className={`toolbar-btn ${activeTool === "pan" ? "active" : ""}`}
        data-tooltip="Pan (H)"
        onClick={() => { onSelectTool("pan"); setFlyoutOpen(null); }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" /><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" /><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 13" /></svg>
      </button>

      <div className="toolbar-divider" />

      {/* Text */}
      <button
        className={`toolbar-btn ${activeTool === "text" ? "active" : ""}`}
        data-tooltip="Text (T)"
        onClick={() => { onSelectTool("text"); setFlyoutOpen(null); }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></svg>
      </button>

      {/* Eraser */}
      <button
        className={`toolbar-btn ${activeTool === "eraser" ? "active" : ""}`}
        data-tooltip="Eraser (E)"
        onClick={() => { onSelectTool("eraser"); setFlyoutOpen(null); }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" /><path d="M22 21H7" /><path d="m5 11 9 9" /></svg>
      </button>
    </div>
  );
}

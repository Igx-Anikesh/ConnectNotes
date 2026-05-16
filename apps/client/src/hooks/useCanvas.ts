"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import type { ToolType } from "@draftboard/shared";

interface DrawingSettings {
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity: number;
  fontFamily: string;
  fontSize: number;
}

function distToSegment(p: {x: number, y: number}, v: {x: number, y: number}, w: {x: number, y: number}) {
  const l2 = (v.x - w.x)**2 + (v.y - w.y)**2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

function recognizeShape(points: {x: number, y: number}[]) {
  if (!points || points.length < 15) return null;
  
  const first = points[0];
  const last = points[points.length - 1];
  const startEndDist = Math.hypot(first.x - last.x, first.y - last.y);
  const isClosed = startEndDist < 50; 
  
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let pathLength = 0;
  for (let i = 0; i < points.length; i++) {
    minX = Math.min(minX, points[i].x);
    minY = Math.min(minY, points[i].y);
    maxX = Math.max(maxX, points[i].x);
    maxY = Math.max(maxY, points[i].y);
    if (i > 0) {
      pathLength += Math.hypot(points[i].x - points[i-1].x, points[i].y - points[i-1].y);
    }
  }
  
  const w = maxX - minX;
  const h = maxY - minY;
  
  if (!isClosed) {
    if (startEndDist > 30 && pathLength < startEndDist * 1.2) {
       return { type: 'line', x1: first.x, y1: first.y, x2: last.x, y2: last.y };
    }
    return null;
  }
  
  const area = w * h;
  if (area < 400) return null; 
  
  const cx = minX + w/2;
  const cy = minY + h/2;
  
  // Calculate Ellipse Score (variance from perfect ellipse)
  let ellipseScore = 0;
  for (const p of points) {
    const nx = (p.x - cx) / (w/2 || 1);
    const ny = (p.y - cy) / (h/2 || 1);
    const dist = Math.hypot(nx, ny);
    ellipseScore += Math.abs(1 - dist);
  }
  ellipseScore /= points.length;

  // Calculate Rectangle Score (average distance to bounding box edges)
  let rectScore = 0;
  for (const p of points) {
    const dLeft = Math.abs(p.x - minX);
    const dRight = Math.abs(p.x - maxX);
    const dTop = Math.abs(p.y - minY);
    const dBottom = Math.abs(p.y - maxY);
    rectScore += Math.min(dLeft, dRight, dTop, dBottom);
  }
  rectScore /= points.length;
  const normalizedRectScore = rectScore / Math.max(w, h);

  // Calculate Triangle Score (finding the best 3-point approximation)
  let minTriScore = Infinity;
  let bestTri: any = null;
  const sample = [];
  const step = Math.max(1, Math.floor(points.length / 15));
  for (let i = 0; i < points.length; i += step) sample.push(points[i]);

  for (let i=0; i<sample.length; i++) {
    for (let j=i+1; j<sample.length; j++) {
      for (let k=j+1; k<sample.length; k++) {
         const a = sample[i], b = sample[j], c = sample[k];
         const areaTri = Math.abs((a.x*(b.y-c.y) + b.x*(c.y-a.y) + c.x*(a.y-b.y))/2);
         if (areaTri < (w*h)*0.2) continue; // too small
         
         let score = 0;
         for (const p of points) {
            const d1 = distToSegment(p, a, b);
            const d2 = distToSegment(p, b, c);
            const d3 = distToSegment(p, c, a);
            score += Math.min(d1, d2, d3);
         }
         score /= points.length;
         
         if (score < minTriScore) {
            minTriScore = score;
            bestTri = [a, b, c];
         }
      }
    }
  }
  const normalizedTriScore = minTriScore / Math.max(w, h);

  type ShapeData = 
    | { left: number; top: number; rx: number; ry: number }
    | { left: number; top: number; width: number; height: number }
    | { left: number; top: number; width: number; height: number; sides: number };

  const scores: { type: string; score: number; data: ShapeData }[] = [
    { type: 'ellipse', score: ellipseScore, data: { left: minX, top: minY, rx: w/2, ry: h/2 } },
    { type: 'rect', score: normalizedRectScore, data: { left: minX, top: minY, width: w, height: h } },
    { type: 'triangle', score: normalizedTriScore, data: { left: minX, top: minY, width: w, height: h } }
  ];

  for (let N = 5; N <= 10; N++) {
    const polyPoints = [];
    for (let i = 0; i < N; i++) {
      polyPoints.push({
        x: cx + (w/2) * Math.cos(2 * Math.PI * i / N - Math.PI / 2),
        y: cy + (h/2) * Math.sin(2 * Math.PI * i / N - Math.PI / 2)
      });
    }
    let nScore = 0;
    for (const p of points) {
      let minDist = Infinity;
      for (let i = 0; i < N; i++) {
        const d = distToSegment(p, polyPoints[i], polyPoints[(i+1)%N]);
        minDist = Math.min(minDist, d);
      }
      nScore += minDist;
    }
    nScore /= points.length;
    scores.push({ type: 'polygon', score: nScore / Math.max(w, h), data: { left: minX, top: minY, width: w, height: h, sides: N } });
  }

  const validScores = scores.filter(s => s.score < 0.25);
  validScores.forEach(s => {
    if (s.type === 'polygon' && 'sides' in s.data) s.score *= (1 + s.data.sides * 0.1); 
    if (s.type === 'ellipse') s.score *= 0.8;
  });
  validScores.sort((a, b) => a.score - b.score);

  if (validScores.length > 0) {
    return { type: validScores[0].type, ...validScores[0].data };
  }
  
  return null;
}

interface UseCanvasOptions {
  activeTool: ToolType;
  drawSettings: DrawingSettings;
}

interface CanvasState {
  zoom: number;
  isPanning: boolean;
  vpX: number;
  vpY: number;
}

export function useCanvas(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: UseCanvasOptions
) {
  const canvasRef = useRef<any>(null);
  const fabricModRef = useRef<any>(null);
  const [state, setState] = useState<CanvasState>({
    zoom: 100, isPanning: false, vpX: 0, vpY: 0,
  });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  
  const historyRef = useRef<string[]>([]);
  const redoRef = useRef<string[]>([]);
  const isHistoryRestoring = useRef(false);
  const lastStateRef = useRef<string | null>(null);
  const drawingOrigin = useRef<{ x: number; y: number } | null>(null);
  const activeShapeRef = useRef<any>(null);
  const panStart = useRef<{ x: number; y: number } | null>(null);
  const lastVptRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const activeToolRef = useRef<ToolType>(options.activeTool);
  const drawSettingsRef = useRef<DrawingSettings>(options.drawSettings);
  const isDrawingNewShape = useRef(false);
  const isEraserDown = useRef(false);
  const eraserDirty = useRef(false);
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);
  // Ref to hold the most recently created freehand path (for shape recognition pairing)
  const lastCreatedPathRef = useRef<any>(null);
  // Refs for undo/redo so keyboard handler always sees latest functions
  const undoFnRef = useRef<() => void>(() => {});
  const redoFnRef = useRef<() => void>(() => {});

  useEffect(() => { activeToolRef.current = options.activeTool; }, [options.activeTool]);
  useEffect(() => { drawSettingsRef.current = options.drawSettings; }, [options.drawSettings]);

  const syncViewport = useCallback((canvas: any) => {
    const vpt = canvas.viewportTransform;
    const zoom = canvas.getZoom();
    if (vpt) {
      setState((s) => ({ ...s, zoom: Math.round(zoom * 100), vpX: vpt[4], vpY: vpt[5] }));
    }
  }, []);

  const clampViewport = useCallback((canvas: any) => {
    const vpt = canvas.viewportTransform;
    if (!vpt) return;
    const zoom = canvas.getZoom();
    const cW = canvas.getWidth();
    const cH = canvas.getHeight();
    const objects = canvas.getObjects();

    if (objects.length === 0) {
      const maxPan = 2000;
      vpt[4] = Math.max(Math.min(vpt[4], maxPan), -maxPan);
      vpt[5] = Math.max(Math.min(vpt[5], maxPan), -maxPan);
    } else {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      objects.forEach((obj: any) => {
        const bound = obj.getBoundingRect();
        const left = (bound.left - vpt[4]) / zoom;
        const top = (bound.top - vpt[5]) / zoom;
        minX = Math.min(minX, left);
        minY = Math.min(minY, top);
        maxX = Math.max(maxX, left + bound.width / zoom);
        maxY = Math.max(maxY, top + bound.height / zoom);
      });
      const pad = Math.max(cW, cH) / zoom * 1.5;
      const contentLeft = minX - pad;
      const contentTop = minY - pad;
      const contentRight = maxX + pad;
      const contentBottom = maxY + pad;
      const maxTX = -contentLeft * zoom + cW * 0.3;
      const minTX = -contentRight * zoom + cW * 0.7;
      const maxTY = -contentTop * zoom + cH * 0.3;
      const minTY = -contentBottom * zoom + cH * 0.7;
      if (maxTX > minTX) vpt[4] = Math.max(Math.min(vpt[4], maxTX), minTX);
      if (maxTY > minTY) vpt[5] = Math.max(Math.min(vpt[5], maxTY), minTY);
    }
    canvas.setViewportTransform(vpt);
  }, []);

  // Initialize canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container || canvasRef.current) return;
    let disposed = false;
    let drawHoldTimeout: ReturnType<typeof setTimeout> | null = null;
    let isDrawingMouseDown = false;
    let lastMoveTime = 0;

    (async () => {
      const fabric = await import("fabric");
      if (disposed) return;
      fabricModRef.current = fabric;

      const canvasEl = document.createElement("canvas");
      canvasEl.id = "draftboard-canvas";
      container.appendChild(canvasEl);

      const canvas = new fabric.Canvas(canvasEl, {
        width: container.clientWidth,
        height: container.clientHeight,
        backgroundColor: "transparent",
        selection: true,
        preserveObjectStacking: true,
        stopContextMenu: true,
        fireRightClick: true,
      });
      canvasRef.current = canvas;

      // Set rotation handle cursor to a rotate icon
      const rotateCursorSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M23 4v6h-6'/%3E%3Cpath d='M20.49 15a9 9 0 1 1-2.12-9.36L23 10'/%3E%3C/svg%3E") 12 12, crosshair`;
      try {
        const mtrControl = fabric.FabricObject.prototype.controls?.mtr;
        if (mtrControl) {
          mtrControl.cursorStyle = rotateCursorSvg;
        }
      } catch { /* older fabric versions may not support this */ }

      // Floating Delete Draft Button
      const draftBtn = document.createElement("button");
      draftBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
        Delete Draft
      `;
      draftBtn.style.position = "absolute";
      draftBtn.style.display = "none";
      draftBtn.style.alignItems = "center";
      draftBtn.style.padding = "6px 12px";
      draftBtn.style.backgroundColor = "#ef4444";
      draftBtn.style.color = "#fff";
      draftBtn.style.border = "none";
      draftBtn.style.borderRadius = "8px";
      draftBtn.style.fontSize = "13px";
      draftBtn.style.fontWeight = "600";
      draftBtn.style.cursor = "pointer";
      draftBtn.style.boxShadow = "0 4px 12px rgba(239, 68, 68, 0.3)";
      draftBtn.style.zIndex = "100";
      draftBtn.style.pointerEvents = "auto";
      
      // --- DRAFT PAIRING SYSTEM ---
      // Both the snapped shape and its draft path carry each other's pairId in .data
      // snapped shape: data.linkedDraftId = pairId
      // draft path:    data.linkedShapeId = pairId
      // This way, selecting either object lets us find the other by scanning canvas.

      let currentDraftActive: any = null;

      /** Given any object, return its pairId if it is part of a draft pair */
      const getPairId = (obj: any): string | null => {
        const d = obj?.data || obj?.get?.('data');
        if (!d) return null;
        return d.linkedDraftId || d.linkedShapeId || null;
      };

      /** Find the partner object on the canvas that shares the same pairId */
      const findPartner = (obj: any): any | null => {
        const d = obj?.data || obj?.get?.('data');
        if (!d) return null;
        const pairId = d.linkedDraftId || d.linkedShapeId;
        if (!pairId) return null;

        // Determine which key the partner would have
        const partnerKey = d.linkedDraftId ? 'linkedShapeId' : 'linkedDraftId';

        for (const o of canvas.getObjects()) {
          if (o === obj) continue;
          const od = (o as any).data || (o as any).get?.('data');
          if (od && od[partnerKey] === pairId) return o;
          // Also match if partner uses the same pairId on the other key
          if (od && (od.linkedDraftId === pairId || od.linkedShapeId === pairId)) return o;
        }
        return null;
      };

      const handleDraftDelete = (e: Event) => {
        e.stopPropagation();
        e.preventDefault();
        const active = canvas.getActiveObject() || currentDraftActive;
        if (!active) return;

        const pairId = getPairId(active);
        if (!pairId) return;

        // Find the draft path partner
        const partner = findPartner(active);

        const activeData = active?.data || active?.get?.('data');

        if (activeData?.linkedDraftId) {
          // User selected the SNAPPED shape → delete the DRAFT path (partner)
          if (partner) canvas.remove(partner);
          // Clear link from the snapped shape
          active.set('data', { ...activeData, linkedDraftId: undefined });
        } else if (activeData?.linkedShapeId) {
          // User selected the DRAFT path → delete it directly
          canvas.remove(active);
          // Clear link from the snapped shape (partner)
          if (partner) {
            const pd = partner.data || partner.get?.('data') || {};
            partner.set('data', { ...pd, linkedDraftId: undefined });
          }
        }

        currentDraftActive = null;
        draftBtn.style.display = 'none';
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      };

      draftBtn.addEventListener('pointerdown', handleDraftDelete, { capture: true });
      draftBtn.addEventListener('mousedown', (e) => e.stopPropagation(), { capture: true });
      draftBtn.addEventListener('click', handleDraftDelete, { capture: true });
      draftBtn.addEventListener('touchstart', handleDraftDelete, { capture: true });
      
      container.appendChild(draftBtn);

      const updateDraftBtn = () => {
        const active = canvas.getActiveObject();
        if (!active) {
          // Delayed hide — give time for button click to fire first
          setTimeout(() => {
            if (!canvas.getActiveObject()) {
              draftBtn.style.display = 'none';
              currentDraftActive = null;
            }
          }, 150);
          return;
        }
        currentDraftActive = active;

        const pairId = getPairId(active);
        const partner = pairId ? findPartner(active) : null;

        if (pairId && partner) {
          const bound = active.getBoundingRect();
          draftBtn.style.display = 'flex';
          requestAnimationFrame(() => {
            if (draftBtn.style.display === 'flex') {
              draftBtn.style.left = `${bound.left + bound.width + 15}px`;
              draftBtn.style.top = `${bound.top + bound.height / 2 - draftBtn.offsetHeight / 2}px`;
            }
          });
        } else {
          draftBtn.style.display = 'none';
        }
      };

      canvas.on('selection:created', updateDraftBtn);
      canvas.on('selection:updated', updateDraftBtn);
      canvas.on('selection:cleared', updateDraftBtn);
      canvas.on('object:moving', updateDraftBtn);

      // ── AUTO-SAVE & HISTORY ──
      let saveTimeout: ReturnType<typeof setTimeout> | null = null;
      const autoSave = () => {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          try {
            const json = (canvas as any).toJSON(['data']);
            localStorage.setItem('draftboard_canvas', JSON.stringify(json));
            localStorage.setItem('draftboard_lastSave', Date.now().toString());
          } catch (err) { /* silently fail for quota */ }
        }, 1000);
      };
      (canvas as any).__autoSave = autoSave;

      const saveHistory = () => {
        if (isHistoryRestoring.current) return;
        if (lastStateRef.current) {
          historyRef.current.push(lastStateRef.current);
          if (historyRef.current.length > 50) historyRef.current.shift();
        }
        const currentState = JSON.stringify((canvas as any).toJSON(['data']));
        lastStateRef.current = currentState;
        redoRef.current = [];
        setCanUndo(historyRef.current.length > 0);
        setCanRedo(false);
      };

      const onCanvasChange = () => {
        if (!isHistoryRestoring.current) {
          saveHistory();
          autoSave();
        }
      };

      canvas.on('object:added', onCanvasChange);
      canvas.on('object:modified', onCanvasChange);
      canvas.on('object:removed', onCanvasChange);

      // ── LOAD SAVED DATA ──
      try {
        const saved = localStorage.getItem('draftboard_canvas');
        if (saved) {
          isHistoryRestoring.current = true;
          canvas.loadFromJSON(JSON.parse(saved)).then(() => {
            canvas.renderAll();
            lastStateRef.current = JSON.stringify((canvas as any).toJSON(['data']));
            isHistoryRestoring.current = false;
          }).catch(() => { isHistoryRestoring.current = false; });
        } else {
          lastStateRef.current = JSON.stringify((canvas as any).toJSON(['data']));
        }
      } catch (err) { /* ignore corrupt data */ }

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          canvas.setDimensions({ width, height });
          canvas.renderAll();
        }
      });
      resizeObserver.observe(container);

      // ── MOUSE DOWN ──
      canvas.on("mouse:down", (e: any) => {
        isDrawingMouseDown = true;
        const tool = activeToolRef.current;
        const ds = drawSettingsRef.current;
        const pointer = canvas.getScenePoint(e.e);

        if (tool === "pan") {
          setState((s) => ({ ...s, isPanning: true }));
          panStart.current = { x: e.e.clientX, y: e.e.clientY };
          const vpt = canvas.viewportTransform;
          if (vpt) lastVptRef.current = { x: vpt[4], y: vpt[5] };
          return;
        }

        if (tool === "eraser") {
          isEraserDown.current = true;
          eraserDirty.current = false;
          const target = canvas.findTarget(e.e);
          if (target) {
            isHistoryRestoring.current = true;
            canvas.remove(target);
            canvas.renderAll();
            eraserDirty.current = true;
          }
          return;
        }

        if (tool === "select") return;

        // Shape tools — check if clicking existing object first
        if (["rect", "ellipse", "triangle", "line", "arrow"].includes(tool)) {
          const target = canvas.findTarget(e.e);
          if (target) {
            canvas.setActiveObject(target);
            canvas.renderAll();
            isDrawingNewShape.current = false;
            return;
          }

          isDrawingNewShape.current = true;
          drawingOrigin.current = { x: pointer.x, y: pointer.y };
          let shape: any;

          if (tool === "rect") {
            shape = new fabric.Rect({
              left: pointer.x, top: pointer.y, width: 0, height: 0,
              fill: ds.fillColor, stroke: ds.strokeColor,
              strokeWidth: ds.strokeWidth, opacity: ds.opacity,
              originX: "left", originY: "top",
              selectable: false, evented: false,
            });
          } else if (tool === "ellipse") {
            shape = new fabric.Ellipse({
              left: pointer.x, top: pointer.y, rx: 0, ry: 0,
              fill: ds.fillColor, stroke: ds.strokeColor,
              strokeWidth: ds.strokeWidth, opacity: ds.opacity,
              originX: "left", originY: "top",
              selectable: false, evented: false,
            });
          } else if (tool === "triangle") {
            shape = new fabric.Triangle({
              left: pointer.x, top: pointer.y, width: 0, height: 0,
              fill: ds.fillColor, stroke: ds.strokeColor,
              strokeWidth: ds.strokeWidth, opacity: ds.opacity,
              originX: "left", originY: "top",
              selectable: false, evented: false,
            });
          } else if (tool === "line" || tool === "arrow") {
            shape = new fabric.Line(
              [pointer.x, pointer.y, pointer.x, pointer.y],
              {
                stroke: ds.strokeColor,
                strokeWidth: ds.strokeWidth, opacity: ds.opacity,
                selectable: false, evented: false,
              }
            );
          }

          if (shape) {
            shape.set("data", { id: (Date.now().toString(36) + Math.random().toString(36).substring(2)), type: tool });
            canvas.add(shape);
            activeShapeRef.current = shape;
          }
        }

        if (tool === "text") {
          const textbox = new fabric.Textbox("Type here...", {
            left: pointer.x, top: pointer.y, width: 200,
            fontSize: ds.fontSize || 24, 
            fontFamily: ds.fontFamily || "'Inter', sans-serif",
            fill: ds.strokeColor, editable: true,
            selectable: true, evented: true,
          });
          textbox.set("data", { id: (Date.now().toString(36) + Math.random().toString(36).substring(2)), type: "text" });
          canvas.add(textbox);
          canvas.setActiveObject(textbox);
          textbox.enterEditing();
          textbox.selectAll();
          canvas.renderAll();
        }
      });

      // ── CAPTURE FREEHAND PATHS for draft pairing ──
      canvas.on("path:created", (opt: any) => {
        if (opt.path) {
          lastCreatedPathRef.current = opt.path;
        }
      });

      // ── MOUSE MOVE ──
      canvas.on("mouse:move", (e: any) => {
        const tool = activeToolRef.current;

        // OneNote-style shape recognition if drawing
        if (canvas.isDrawingMode && isDrawingMouseDown) {
          lastMoveTime = Date.now();
          if (drawHoldTimeout) clearTimeout(drawHoldTimeout);
          drawHoldTimeout = setTimeout(() => {
            if (isDrawingMouseDown && Date.now() - lastMoveTime >= 400) {
              const brush = canvas.freeDrawingBrush as any;
              if (brush && brush._points && brush._points.length > 20) {
                const shapeDef = recognizeShape(brush._points);
                if (shapeDef) {
                  // Clear the lastCreatedPath ref so we can capture the new one
                  lastCreatedPathRef.current = null;
                  
                  try { brush.onMouseUp({ e: e.e }); } catch(err) {}
                  isDrawingMouseDown = false;
                  
                  // Wait for Fabric's path:created event to fire and populate lastCreatedPathRef
                  const findAndReplace = () => {
                    const roughDraftObj = lastCreatedPathRef.current;
                    lastCreatedPathRef.current = null;
                    
                    const ds = drawSettingsRef.current;
                    let newShape: any;
                    let strokeColor = ds.strokeColor;
                    let strokeWidth = ds.strokeWidth;
                    let opacity = ds.opacity;

                    if (tool === 'highlighter') {
                      if (strokeColor.startsWith("#") && strokeColor.length === 7) strokeColor += "66";
                      strokeWidth = strokeWidth * 3 + 10;
                    } else if (tool === 'brush') {
                      strokeWidth = strokeWidth * 2 + 5;
                    }

                    const def = shapeDef as any;

                    if (shapeDef.type === 'ellipse') {
                      newShape = new fabricModRef.current.Ellipse({
                        left: def.left, top: def.top, rx: def.rx, ry: def.ry,
                        fill: ds.fillColor, stroke: strokeColor, strokeWidth: strokeWidth,
                        opacity: opacity, originX: 'left', originY: 'top'
                      });
                    } else if (shapeDef.type === 'rect') {
                      newShape = new fabricModRef.current.Rect({
                        left: def.left, top: def.top, width: def.width, height: def.height,
                        fill: ds.fillColor, stroke: strokeColor, strokeWidth: strokeWidth,
                        opacity: opacity, originX: 'left', originY: 'top'
                      });
                    } else if (shapeDef.type === 'triangle') {
                      newShape = new fabricModRef.current.Triangle({
                        left: def.left, top: def.top, width: def.width, height: def.height,
                        fill: ds.fillColor, stroke: strokeColor, strokeWidth: strokeWidth,
                        opacity: opacity, originX: 'left', originY: 'top'
                      });
                    } else if (shapeDef.type === 'line') {
                      newShape = new fabricModRef.current.Line([def.x1!, def.y1!, def.x2!, def.y2!], {
                        stroke: strokeColor, strokeWidth: strokeWidth, opacity: opacity
                      });
                    } else if (shapeDef.type === 'polygon') {
                      const N = def.sides;
                      const polyPts = [];
                      for (let i = 0; i < N; i++) {
                        polyPts.push({
                          x: def.left + def.width/2 + (def.width/2) * Math.cos(2 * Math.PI * i / N - Math.PI / 2),
                          y: def.top + def.height/2 + (def.height/2) * Math.sin(2 * Math.PI * i / N - Math.PI / 2)
                        });
                      }
                      newShape = new fabricModRef.current.Polygon(polyPts, {
                        fill: ds.fillColor, stroke: strokeColor, strokeWidth: strokeWidth,
                        opacity: opacity
                      });
                    }
                    
                    if (newShape) {
                      // Generate a unique pairId that links the snapped shape ↔ draft path
                      const pairId = (Date.now().toString(36) + Math.random().toString(36).substring(2));
                      const shapeId = (Date.now().toString(36) + Math.random().toString(36).substring(2) + 's');
                      
                      // Tag the snapped shape: linkedDraftId points to the pair
                      newShape.set('data', { id: shapeId, type: shapeDef.type, linkedDraftId: pairId });
                      
                      // Tag the draft path: linkedShapeId points to the same pair
                      if (roughDraftObj) {
                        const existingData = roughDraftObj.data || roughDraftObj.get?.('data') || {};
                        roughDraftObj.set('data', { ...existingData, linkedShapeId: pairId });
                      }
                      
                      canvas.add(newShape);
                      canvas.setActiveObject(newShape);
                      canvas.requestRenderAll();
                    }
                  };
                  
                  // Wait 120ms for Fabric's path:created event to fire
                  setTimeout(findAndReplace, 120);
                }
              }
            }
          }, 450);
        }

        // Swipe eraser: delete anything the cursor passes over while held
        if (tool === "eraser" && isEraserDown.current) {
          const target = canvas.findTarget(e.e);
          if (target) {
            canvas.remove(target);
            canvas.renderAll();
            eraserDirty.current = true;
          }
          return;
        }

        if (tool === "pan" && panStart.current) {
          const dx = e.e.clientX - panStart.current.x;
          const dy = e.e.clientY - panStart.current.y;
          const vpt = [...canvas.viewportTransform!];
          vpt[4] = lastVptRef.current.x + dx;
          vpt[5] = lastVptRef.current.y + dy;
          canvas.setViewportTransform(vpt as [number, number, number, number, number, number]);
          syncViewport(canvas);
          return;
        }

        if (!isDrawingNewShape.current || !drawingOrigin.current || !activeShapeRef.current) return;
        const pointer = canvas.getScenePoint(e.e);
        const origin = drawingOrigin.current;
        const shape = activeShapeRef.current;

        if (tool === "rect") {
          shape.set({
            left: Math.min(pointer.x, origin.x),
            top: Math.min(pointer.y, origin.y),
            width: Math.abs(pointer.x - origin.x),
            height: Math.abs(pointer.y - origin.y),
          });
        } else if (tool === "ellipse") {
          shape.set({
            left: Math.min(pointer.x, origin.x),
            top: Math.min(pointer.y, origin.y),
            rx: Math.abs(pointer.x - origin.x) / 2,
            ry: Math.abs(pointer.y - origin.y) / 2,
          });
        } else if (tool === "triangle") {
          shape.set({
            left: Math.min(pointer.x, origin.x),
            top: Math.min(pointer.y, origin.y),
            width: Math.abs(pointer.x - origin.x),
            height: Math.abs(pointer.y - origin.y),
          });
        } else if (tool === "line" || tool === "arrow") {
          shape.set({ x2: pointer.x, y2: pointer.y });
        }
        canvas.renderAll();
      });

      // ── MOUSE UP ──
      canvas.on("mouse:up", () => {
        isDrawingMouseDown = false;
        if (drawHoldTimeout) clearTimeout(drawHoldTimeout);

        const tool = activeToolRef.current;

        // Reset eraser swipe state — commit one history entry for the whole stroke
        if (tool === "eraser") {
          isEraserDown.current = false;
          if (eraserDirty.current) {
            isHistoryRestoring.current = false;
            // Manually save one history snapshot for everything that was erased
            saveHistory();
            autoSave();
            eraserDirty.current = false;
          }
          return;
        }

        if (tool === "pan") {
          setState((s) => ({ ...s, isPanning: false }));
          panStart.current = null;
          clampViewport(canvas);
          syncViewport(canvas);
          return;
        }

        if (activeShapeRef.current && isDrawingNewShape.current) {
          const shape = activeShapeRef.current;
          const w = shape.width || shape.rx || 0;
          const h = shape.height || shape.ry || 0;
          const len = shape.x2 !== undefined
            ? Math.hypot((shape.x2 - shape.x1), (shape.y2 - shape.y1))
            : 0;
          if (w < 3 && h < 3 && len < 3) {
            canvas.remove(shape);
          } else {
            shape.setCoords();
            shape.set({ selectable: true, evented: true });
          }
          activeShapeRef.current = null;
        }
        isDrawingNewShape.current = false;
        drawingOrigin.current = null;
        canvas.renderAll();
      });

      // ── TOUCH (PINCH TO ZOOM & TWO-FINGER PAN) ──
      let initialPinchDistance = 0;
      let initialZoom = 1;
      let lastTouchCenter = { x: 0, y: 0 };

      container.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
          e.preventDefault();
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          initialPinchDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
          initialZoom = canvas.getZoom();
          lastTouchCenter = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
        }
      }, { passive: false });

      container.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
          e.preventDefault();
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          const currentDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
          const currentCenter = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
          
          if (initialPinchDistance > 0) {
            let zoom = initialZoom * (currentDistance / initialPinchDistance);
            zoom = Math.min(Math.max(zoom, 0.25), 5);
            const point = new (fabricModRef.current.Point)(currentCenter.x, currentCenter.y);
            canvas.zoomToPoint(point, zoom);
          }

          const dx = currentCenter.x - lastTouchCenter.x;
          const dy = currentCenter.y - lastTouchCenter.y;
          const vpt = [...canvas.viewportTransform!];
          vpt[4] += dx;
          vpt[5] += dy;
          canvas.setViewportTransform(vpt as [number, number, number, number, number, number]);
          
          lastTouchCenter = currentCenter;
          clampViewport(canvas);
          syncViewport(canvas);
        }
      }, { passive: false });

      container.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
          initialPinchDistance = 0;
        }
      });

      // ── WHEEL (PAN / ZOOM) ──
      canvas.on("mouse:wheel", (opt: any) => {
        const e = opt.e as WheelEvent;
        e.preventDefault();
        e.stopPropagation();

        if (e.ctrlKey || e.metaKey) {
          // PINCH-TO-ZOOM / CTRL+SCROLL
          let zoom = canvas.getZoom();
          const delta = -e.deltaY;
          // slightly slower zoom for touchpad pinching
          const factor = 1 + delta * 0.005;
          zoom *= factor;
          // Limit zoom out to 25%
          zoom = Math.min(Math.max(zoom, 0.25), 5);
          const point = new (fabricModRef.current.Point)(e.offsetX, e.offsetY);
          canvas.zoomToPoint(point, zoom);
          clampViewport(canvas);
          syncViewport(canvas);
        } else {
          // SWIPE TO PAN / NORMAL SCROLL
          const vpt = [...canvas.viewportTransform!];
          vpt[4] -= e.deltaX;
          vpt[5] -= e.deltaY;
          canvas.setViewportTransform(vpt as [number, number, number, number, number, number]);
          clampViewport(canvas);
          syncViewport(canvas);
        }
      });

      // Key events for Undo/Redo, Delete, and Duplicate
      const onKey = (ev: KeyboardEvent) => {
        const target = ev.target as HTMLElement;
        const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
        const active = canvas.getActiveObject();
        const isEditingCanvasText = active && (active as any).isEditing;

        if (!isInput && !isEditingCanvasText) {
          // Ctrl+Z / Ctrl+Shift+Z
          if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") {
            ev.preventDefault();
            if (ev.shiftKey) {
              redoFnRef.current();
            } else {
              undoFnRef.current();
            }
            return;
          }
          // Ctrl+Y
          if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "y") {
            ev.preventDefault();
            redoFnRef.current();
            return;
          }
          // Shift+D — Duplicate selected objects
          if (ev.shiftKey && ev.key.toLowerCase() === "d") {
            ev.preventDefault();
            const activeObjs = canvas.getActiveObjects();
            if (activeObjs.length === 0) return;
            canvas.discardActiveObject();
            const clones: any[] = [];
            let remaining = activeObjs.length;
            activeObjs.forEach((obj: any) => {
              obj.clone().then((cloned: any) => {
                cloned.set({
                  left: (cloned.left || 0) + 20,
                  top: (cloned.top || 0) + 20,
                  evented: true,
                  selectable: true,
                });
                // Give clone a new unique id
                const existingData = cloned.data || {};
                cloned.set('data', {
                  ...existingData,
                  id: Date.now().toString(36) + Math.random().toString(36).substring(2),
                });
                canvas.add(cloned);
                clones.push(cloned);
                remaining--;
                if (remaining === 0) {
                  if (clones.length === 1) {
                    canvas.setActiveObject(clones[0]);
                  } else {
                    const sel = new (fabricModRef.current.ActiveSelection)(clones, { canvas });
                    canvas.setActiveObject(sel);
                  }
                  canvas.requestRenderAll();
                }
              });
            });
            return;
          }
        }

        if (ev.key === "Delete" || ev.key === "Backspace") {
          if (isEditingCanvasText || isInput) return;
          canvas.getActiveObjects().forEach((obj: any) => canvas.remove(obj));
          canvas.discardActiveObject();
          canvas.renderAll();
        }
      };
      window.addEventListener("keydown", onKey);

      // Track cursor position for button-based zoom
      const onMouseMove = (ev: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        lastMousePos.current = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
      };
      container.addEventListener("mousemove", onMouseMove);

      (canvas as any).__cleanup = () => {
        resizeObserver.disconnect();
        window.removeEventListener("keydown", onKey);
        container.removeEventListener("mousemove", onMouseMove);
        if (draftBtn && draftBtn.parentNode) draftBtn.parentNode.removeChild(draftBtn);
      };
    })();

    return () => {
      disposed = true;
      if (canvasRef.current) {
        (canvasRef.current as any).__cleanup?.();
        canvasRef.current.dispose();
        canvasRef.current = null;
      }
      const c = containerRef.current;
      if (c) {
        const el = c.querySelector("#draftboard-canvas");
        if (el) c.removeChild(el);
      }
    };
  }, [containerRef, syncViewport, clampViewport]);

  // Tool changes
  useEffect(() => {
    const canvas = canvasRef.current;
    const fabric = fabricModRef.current;
    if (!canvas || !fabric) return;

    canvas.isDrawingMode = false;
    canvas.selection = options.activeTool === "select";

    const isPenMode = ["pen", "brush", "highlighter", "spray", "circle_brush"].includes(options.activeTool);
    canvas.isDrawingMode = isPenMode;

    if (isPenMode) {
      let newBrush: any;

      if (options.activeTool === "spray") {
        newBrush = new fabric.SprayBrush(canvas);
        newBrush.color = options.drawSettings.strokeColor;
        newBrush.width = options.drawSettings.strokeWidth * 4 + 15;
        newBrush.density = 20;
        newBrush.dotWidthVariance = 3;
      } else if (options.activeTool === "circle_brush") {
        newBrush = new fabric.CircleBrush(canvas);
        newBrush.color = options.drawSettings.strokeColor;
        newBrush.width = options.drawSettings.strokeWidth * 3 + 8;
      } else {
        newBrush = new fabric.PencilBrush(canvas);
        if (options.activeTool === "highlighter") {
          let color = options.drawSettings.strokeColor;
          if (color.startsWith("#") && color.length === 7) {
            color = color + "66"; // 40% opacity
          }
          newBrush.color = color;
          newBrush.width = options.drawSettings.strokeWidth * 3 + 10;
        } else if (options.activeTool === "brush") {
          newBrush.color = options.drawSettings.strokeColor;
          newBrush.width = options.drawSettings.strokeWidth * 2 + 5;
        } else {
          newBrush.color = options.drawSettings.strokeColor;
          newBrush.width = options.drawSettings.strokeWidth;
        }
      }
      canvas.freeDrawingBrush = newBrush;
    }

    const interactable = options.activeTool === "select" ||
      ["rect", "ellipse", "triangle", "line", "arrow", "eraser"].includes(options.activeTool);

    canvas.forEachObject((obj: any) => {
      obj.selectable = options.activeTool === "select";
      obj.evented = interactable;
    });
    canvas.renderAll();
  }, [options.activeTool, options.drawSettings]);

  const setZoom = useCallback((newZoom: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Enforce 25% to 500% bounds
    const clampedZoom = Math.min(Math.max(newZoom, 25), 500);

    // Zoom toward last known cursor position, fallback to center
    const point = lastMousePos.current
      ? new (fabricModRef.current.Point)(lastMousePos.current.x, lastMousePos.current.y)
      : canvas.getCenterPoint();
    canvas.zoomToPoint(point, clampedZoom / 100);
    clampViewport(canvas);
    syncViewport(canvas);
  }, [clampViewport, syncViewport]);

  const resetView = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    syncViewport(canvas);
  }, [syncViewport]);

  // ── Helper: render content to a data URL with smart cropping (ASYNC) ──
  const renderToImage = useCallback(async (): Promise<string | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const objects = canvas.getObjects();
    if (objects.length === 0) return null;

    // 1. Save current state
    const prevVpt = [...canvas.viewportTransform!] as [number, number, number, number, number, number];
    const prevW = canvas.getWidth();
    const prevH = canvas.getHeight();
    canvas.discardActiveObject();

    // 2. Reset viewport to identity so we can measure in world coords
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.renderAll();

    // 3. Calculate tight bounding box of ALL content (world coords)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    objects.forEach((obj: any) => {
      const bound = obj.getBoundingRect();
      minX = Math.min(minX, bound.left);
      minY = Math.min(minY, bound.top);
      maxX = Math.max(maxX, bound.left + bound.width);
      maxY = Math.max(maxY, bound.top + bound.height);
    });

    // 4. Margin around content
    const margin = 60;
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const exportW = contentW + margin * 2;
    const exportH = contentH + margin * 2;

    // 5. Get the actual background color the user sees from CSS
    const rootStyle = getComputedStyle(document.documentElement);
    const bgColor = rootStyle.getPropertyValue('--canvas-bg').trim() || '#0d0d0d';

    // 6. Temporarily resize the Fabric canvas to fit ALL content
    //    and shift the viewport so the content area starts at (margin, margin)
    canvas.setDimensions({ width: exportW, height: exportH });
    canvas.setViewportTransform([1, 0, 0, 1, -minX + margin, -minY + margin]);
    canvas.backgroundColor = bgColor;
    canvas.renderAll();

    // 7. Render to data URL at 2x for high quality
    const scale = 2;
    const fullDataURL = canvas.toDataURL({ format: 'png', multiplier: scale });

    // 8. Restore everything immediately
    canvas.backgroundColor = 'transparent';
    canvas.setDimensions({ width: prevW, height: prevH });
    canvas.setViewportTransform(prevVpt);
    canvas.renderAll();

    // 9. Wait for image load and return
    return new Promise<string | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.src);
      img.onerror = () => resolve(null);
      img.src = fullDataURL;
    });
  }, []);

  // ── UNDO / REDO ──
  const undo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || historyRef.current.length === 0) return;
    
    isHistoryRestoring.current = true;
    const currentState = lastStateRef.current || JSON.stringify((canvas as any).toJSON(['data']));
    redoRef.current.push(currentState);
    
    const prevState = historyRef.current.pop()!;
    lastStateRef.current = prevState;
    
    canvas.loadFromJSON(JSON.parse(prevState)).then(() => {
      canvas.renderAll();
      isHistoryRestoring.current = false;
      setCanUndo(historyRef.current.length > 0);
      setCanRedo(redoRef.current.length > 0);
      if (canvas.__autoSave) canvas.__autoSave();
    });
  }, []);

  const redo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || redoRef.current.length === 0) return;

    isHistoryRestoring.current = true;
    const currentState = lastStateRef.current || JSON.stringify((canvas as any).toJSON(['data']));
    historyRef.current.push(currentState);

    const nextState = redoRef.current.pop()!;
    lastStateRef.current = nextState;

    canvas.loadFromJSON(JSON.parse(nextState)).then(() => {
      canvas.renderAll();
      isHistoryRestoring.current = false;
      setCanUndo(historyRef.current.length > 0);
      setCanRedo(redoRef.current.length > 0);
      if (canvas.__autoSave) canvas.__autoSave();
    });
  }, []);

  // Keep refs in sync so keyboard handler always calls the latest undo/redo
  useEffect(() => {
    undoFnRef.current = undo;
    redoFnRef.current = redo;
  }, [undo, redo]);

  // ── EXPORT AS PNG ──
  const exportCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const objects = canvas.getObjects();
    if (objects.length === 0) {
      alert("Nothing to export — draw something first!");
      return;
    }

    try {
      const dataURL = await renderToImage();
      if (!dataURL) {
        alert("Export failed — couldn't render content.");
        return;
      }

      const link = document.createElement('a');
      link.download = `draftboard-${Date.now()}.png`;
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Try again.');
    }
  }, [renderToImage]);

  // ── SHARE ──
  const shareCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const objects = canvas.getObjects();
    if (objects.length === 0) {
      alert("Nothing to share — draw something first!");
      return;
    }

    try {
      const dataURL = await renderToImage();
      if (!dataURL) {
        alert("Share failed — couldn't render content.");
        return;
      }

      const res = await fetch(dataURL);
      const blob = await res.blob();
      const file = new File([blob], 'draftboard.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'DraftBoard', text: 'Check out my DraftBoard creation!' });
      } else {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
          alert('Image copied to clipboard!');
        } catch {
          const link = document.createElement('a');
          link.download = `draftboard-${Date.now()}.png`;
          link.href = dataURL;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
    } catch (err) {
      console.error('Share failed:', err);
      alert('Share failed. Try again.');
    }
  }, [renderToImage]);

  return {
    canvas: canvasRef,
    zoom: state.zoom,
    isPanning: state.isPanning,
    vpX: state.vpX,
    vpY: state.vpY,
    setZoom,
    resetView,
    exportCanvas,
    shareCanvas,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}

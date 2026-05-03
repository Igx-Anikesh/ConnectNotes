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

  // Compare scores and pick the best fit, if within reasonable threshold
  const scores = [
    { type: 'ellipse', score: ellipseScore, data: { left: minX, top: minY, rx: w/2, ry: h/2 } },
    { type: 'rect', score: normalizedRectScore, data: { left: minX, top: minY, width: w, height: h } },
    { type: 'triangle', score: normalizedTriScore, data: { left: minX, top: minY, width: w, height: h } }
  ].filter(s => s.score < 0.15).sort((a, b) => a.score - b.score);

  if (scores.length > 0) {
    return { type: scores[0].type, ...scores[0].data };
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
  const drawingOrigin = useRef<{ x: number; y: number } | null>(null);
  const activeShapeRef = useRef<any>(null);
  const panStart = useRef<{ x: number; y: number } | null>(null);
  const lastVptRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const activeToolRef = useRef<ToolType>(options.activeTool);
  const drawSettingsRef = useRef<DrawingSettings>(options.drawSettings);
  const isDrawingNewShape = useRef(false);
  const isEraserDown = useRef(false);
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);
  // Map to track snapped shape → rough draft pairs
  const draftPairsRef = useRef<Map<any, any>>(new Map());

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
      
      const draftPairs = draftPairsRef.current;

      const getDraftId = (obj: any): string | null => {
        const d = obj?.data || obj?.get?.('data');
        return d?.linkedDraftId || null;
      };

      const handleDraftDelete = (e: Event) => {
        e.stopPropagation();
        e.preventDefault();
        const active = canvas.getActiveObject();
        if (!active) return;
        
        const draftId = getDraftId(active);
        if (draftId && draftPairs.has(draftId)) {
          const draftObj = draftPairs.get(draftId);
          if (draftObj) {
            canvas.remove(draftObj);
          }
          draftPairs.delete(draftId);
          // Also clear the linkage from the snapped shape
          const activeAny = active as any;
          const data = activeAny.data || activeAny.get?.('data') || {};
          activeAny.set("data", { ...data, linkedDraftId: undefined });
          draftBtn.style.display = "none";
          canvas.requestRenderAll();
        }
      };

      draftBtn.onpointerdown = handleDraftDelete;
      draftBtn.onmousedown = (e) => e.stopPropagation();
      draftBtn.onclick = handleDraftDelete;
      draftBtn.ontouchstart = handleDraftDelete;
      
      container.appendChild(draftBtn);

      const updateDraftBtn = () => {
        const active = canvas.getActiveObject();
        if (!active) { draftBtn.style.display = "none"; return; }
        
        const draftId = getDraftId(active);
        if (draftId && draftPairs.has(draftId)) {
           const bound = active.getBoundingRect();
           draftBtn.style.display = "flex";
           setTimeout(() => {
             if (draftBtn.style.display === "flex") {
               draftBtn.style.left = `${bound.left + bound.width + 15}px`;
               draftBtn.style.top = `${bound.top + bound.height / 2 - draftBtn.offsetHeight / 2}px`;
             }
           }, 0);
        } else {
           draftBtn.style.display = "none";
        }
      };

      canvas.on("after:render", updateDraftBtn);

      // ── AUTO-SAVE ──
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
      canvas.on('object:added', autoSave);
      canvas.on('object:modified', autoSave);
      canvas.on('object:removed', autoSave);

      // ── LOAD SAVED DATA ──
      try {
        const saved = localStorage.getItem('draftboard_canvas');
        if (saved) {
          canvas.loadFromJSON(JSON.parse(saved)).then(() => {
            canvas.renderAll();
          }).catch(() => {});
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
          const target = canvas.findTarget(e.e);
          if (target) { canvas.remove(target); canvas.renderAll(); }
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
            shape.set("data", { id: crypto.randomUUID(), type: tool });
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
          textbox.set("data", { id: crypto.randomUUID(), type: "text" });
          canvas.add(textbox);
          canvas.setActiveObject(textbox);
          textbox.enterEditing();
          textbox.selectAll();
          canvas.renderAll();
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
                  // Snapshot the object count BEFORE the brush finalizes
                  const objCountBefore = canvas.getObjects().length;
                  
                  try { brush.onMouseUp({ e: e.e }); } catch(err) {}
                  isDrawingMouseDown = false;
                  
                  // Use a longer wait + polling to ensure Fabric has added the path
                  const findAndReplace = () => {
                    const objs = canvas.getObjects();
                    // The rough draft is any new path added since we snapshotted
                    let roughDraftObj: any = null;
                    if (objs.length > objCountBefore) {
                      const candidate = objs[objs.length - 1];
                      if (candidate && candidate.type === 'path') {
                        roughDraftObj = candidate;
                      }
                    }
                    
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
                    }
                    
                    if (newShape) {
                      const draftId = crypto.randomUUID();
                      newShape.set("data", { id: crypto.randomUUID(), type: shapeDef.type, linkedDraftId: draftId });
                      
                      if (roughDraftObj) {
                        // Tag the rough draft with the draftId and store in map
                        roughDraftObj.set("data", { ...(roughDraftObj.data || {}), draftId: draftId });
                        draftPairsRef.current.set(draftId, roughDraftObj);
                      }
                      
                      canvas.add(newShape);
                      canvas.setActiveObject(newShape);
                      canvas.renderAll();
                    }
                  };
                  
                  // Wait 50ms for Fabric to finalize the path, then run
                  setTimeout(findAndReplace, 50);
                }
              }
            }
          }, 450);
        }

        // Swipe eraser: delete anything the cursor passes over while held
        if (tool === "eraser" && isEraserDown.current) {
          const target = canvas.findTarget(e.e);
          if (target) { canvas.remove(target); canvas.renderAll(); }
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

        // Reset eraser swipe state
        if (tool === "eraser") {
          isEraserDown.current = false;
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

      // Delete
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key === "Delete" || ev.key === "Backspace") {
          const active = canvas.getActiveObject();
          if (active && (active as any).isEditing) return;
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

    const isPenMode = ["pen", "brush", "highlighter"].includes(options.activeTool);
    canvas.isDrawingMode = isPenMode;

    if (isPenMode) {
      const brush = new fabric.PencilBrush(canvas);
      if (options.activeTool === "highlighter") {
        let color = options.drawSettings.strokeColor;
        if (color.startsWith("#") && color.length === 7) {
          color = color + "66"; // 40% opacity
        }
        brush.color = color;
        brush.width = options.drawSettings.strokeWidth * 3 + 10;
      } else if (options.activeTool === "brush") {
        brush.color = options.drawSettings.strokeColor;
        brush.width = options.drawSettings.strokeWidth * 2 + 5;
      } else {
        brush.color = options.drawSettings.strokeColor;
        brush.width = options.drawSettings.strokeWidth;
      }
      canvas.freeDrawingBrush = brush;
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

  // ── Helper: render content to a data URL with smart cropping ──
  const renderToImage = useCallback((): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const objects = canvas.getObjects();
    if (objects.length === 0) return null;

    // 1. Reset viewport to identity so getBoundingRect is in world coords
    const prevVpt = [...canvas.viewportTransform!];
    const prevBg = canvas.backgroundColor;
    canvas.discardActiveObject();
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.renderAll();

    // 2. Calculate tight bounding box of ALL content
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    objects.forEach((obj: any) => {
      const bound = obj.getBoundingRect();
      minX = Math.min(minX, bound.left);
      minY = Math.min(minY, bound.top);
      maxX = Math.max(maxX, bound.left + bound.width);
      maxY = Math.max(maxY, bound.top + bound.height);
    });

    // 3. Define margin (40px on each side)
    const margin = 40;
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const exportW = contentW + margin * 2;
    const exportH = contentH + margin * 2;

    // 4. Create offscreen canvas at 2x resolution
    const scale = 2;
    const offscreen = document.createElement('canvas');
    offscreen.width = exportW * scale;
    offscreen.height = exportH * scale;
    const ctx = offscreen.getContext('2d')!;

    // 5. Fill background
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);

    // 6. Render Fabric canvas to a temp full image, then crop
    const fullDataURL = canvas.toDataURL({ format: 'png', multiplier: scale });

    // Restore viewport immediately
    canvas.backgroundColor = prevBg;
    canvas.setViewportTransform(prevVpt);
    canvas.renderAll();

    // 7. Draw the cropped region onto the offscreen canvas
    const img = new Image();
    img.src = fullDataURL;

    // Since img.src is a data URL, it loads synchronously in most browsers
    // but let's use a synchronous approach by drawing directly
    ctx.drawImage(
      img,
      minX * scale, minY * scale,         // source x, y
      contentW * scale, contentH * scale,  // source w, h
      margin * scale, margin * scale,      // dest x, y
      contentW * scale, contentH * scale   // dest w, h
    );

    return offscreen.toDataURL('image/png', 1.0);
  }, []);

  // ── EXPORT AS PNG ──
  const exportCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const objects = canvas.getObjects();
    if (objects.length === 0) {
      alert("Nothing to export — draw something first!");
      return;
    }

    try {
      const dataURL = renderToImage();
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
      const dataURL = renderToImage();
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
  };
}

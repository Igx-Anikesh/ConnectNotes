"use client";

import { useState, useCallback, useEffect } from "react";
import type { ToolType } from "@draftboard/shared";

export function useTools() {
  const [activeTool, setActiveTool] = useState<ToolType>("select");

  const selectTool = useCallback((tool: ToolType) => {
    setActiveTool(tool);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      const key = e.key.toUpperCase();
      const shortcuts: Record<string, ToolType> = {
        V: "select", R: "rect", O: "ellipse", L: "line",
        A: "arrow", P: "pen", T: "text", H: "pan",
        S: "sticky", E: "eraser",
      };

      if (shortcuts[key]) {
        e.preventDefault();
        setActiveTool(shortcuts[key]);
      }

      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setActiveTool("pan");
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setActiveTool("select");
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  return { activeTool, selectTool };
}

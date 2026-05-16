export type CanvasBackgroundMode = 'dots' | 'blank' | 'grid';

export type ToolType = 
  | 'select'
  | 'pan'
  | 'rect'
  | 'ellipse'
  | 'triangle'
  | 'line'
  | 'arrow'
  | 'text'
  | 'pen'
  | 'brush'
  | 'highlighter'
  | 'spray'
  | 'circle_brush'
  | 'sticky'
  | 'eraser';

export type SemanticType = 'idea' | 'task' | 'decision' | 'note' | 'connector' | null;

export interface BoardElement {
  id: string;
  type: 'rect' | 'ellipse' | 'triangle' | 'line' | 'arrow' | 'text' | 'pen' | 'brush' | 'highlighter' | 'group' | 'sticky';
  
  // Geometry
  x: number;
  y: number;
  width?: number;
  height?: number;
  angle?: number;
  scaleX?: number;
  scaleY?: number;
  points?: number[][];
  
  // Style
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  fontSize?: number;
  fontFamily?: string;
  text?: string;
  
  // Metadata
  meta: {
    createdBy: string;
    createdAt: number;
    groupId: string | null;
    semanticType: SemanticType;
    locked: boolean;
  };
  
  // Connections (for arrows)
  connections?: {
    from?: string;
    to?: string;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface Board {
  id: string;
  title: string;
  ownerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Room {
  boardId: string;
  users: Map<string, { name: string; color: string; cursor?: { x: number; y: number } }>;
}

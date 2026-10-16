export interface Glyph { char: string; font: string; x: number; y: number; size: number }
export interface Segment { x1: number; y1: number; x2: number; y2: number; width: number }
export interface Shape { pts: [number, number][]; curves: boolean; x1: number; x2: number; y1: number; y2: number }
export interface PageData { index: number; width: number; height: number; glyphs: Glyph[]; segments: Segment[]; shapes: Shape[] }

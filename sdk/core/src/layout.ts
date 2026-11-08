import type { Rect } from "./orb";

export interface LayoutLayerInput {
  layerIndex: number;
  rect: Rect;
}

export interface LayoutInput {
  canvas: { width: number; height: number };
  viewport: { width: number; height: number };
  fit?: "contain" | "cover";
  displayScale?: number;
  portraitScale?: number;
  layers?: LayoutLayerInput[];
}

export interface LayoutLayer {
  layerIndex: number;
  rect: Rect;
}

export interface LayoutPlan {
  scale: number;
  destinationRect: Rect;
  layers: LayoutLayer[];
}

export function computeLayout(input: LayoutInput): LayoutPlan {
  const { canvas, viewport } = input;
  const cover = input.fit === "cover";
  const displayScale = typeof input.displayScale === "number" ? input.displayScale : 1;
  const portraitScale = typeof input.portraitScale === "number" ? input.portraitScale : 1.25;
  const fitScale = Math.min(viewport.width / canvas.width, viewport.height / canvas.height);
  const coverScale = Math.max(viewport.width / canvas.width, viewport.height / canvas.height);
  const base = cover
    ? coverScale
    : fitScale * (viewport.height > viewport.width ? portraitScale : 1);
  const scale = base * (cover ? 1 : displayScale);
  const width = canvas.width * scale;
  const height = canvas.height * scale;
  const destinationRect: Rect = {
    x: (viewport.width - width) / 2,
    y: (viewport.height - height) / 2,
    width,
    height,
  };
  const layers = (input.layers || []).map((layer) => ({
    layerIndex: layer.layerIndex,
    rect: {
      x: destinationRect.x + layer.rect.x * scale,
      y: destinationRect.y + layer.rect.y * scale,
      width: layer.rect.width * scale,
      height: layer.rect.height * scale,
    },
  }));
  return { scale, destinationRect, layers };
}

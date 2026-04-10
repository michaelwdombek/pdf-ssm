/**
 * Coordinate utilities for SignDesk.
 *
 * Annotations are stored in normalized [0, 1] coordinates relative to the PDF
 * page dimensions. This module converts between:
 *   - Normalized coords (storage)
 *   - Pixel coords (CSS overlay positioning)
 *   - PDF-lib coords (export, with y-axis inversion)
 */

/** Convert a pixel position within a rendered canvas to normalized [0, 1] coords. */
export function pixelToNormalized(
  pixelX: number,
  pixelY: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  return {
    x: pixelX / canvasWidth,
    y: pixelY / canvasHeight,
  }
}

/** Convert normalized [0, 1] coords to CSS pixel position for overlay rendering. */
export function normalizedToPixel(
  normX: number,
  normY: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  return {
    x: normX * canvasWidth,
    y: normY * canvasHeight,
  }
}

/**
 * Convert normalized annotation coords to pdf-lib drawing coords.
 *
 * IMPORTANT: PDF.js uses a top-left origin (y increases downward).
 * pdf-lib uses a bottom-left origin (y increases upward).
 * This function handles the inversion:
 *   pdfY = pageHeight * (1 - normY - normH)
 */
export function normalizedToPdfCoords(
  normX: number,
  normY: number,
  normW: number,
  normH: number,
  pdfPageWidth: number,
  pdfPageHeight: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: normX * pdfPageWidth,
    y: pdfPageHeight * (1 - normY - normH),
    width: normW * pdfPageWidth,
    height: normH * pdfPageHeight,
  }
}

/**
 * Clamp annotation top-left position so it stays within the page.
 * w and h are the annotation's normalized width and height.
 */
export function clampAnnotation(
  x: number,
  y: number,
  w: number,
  h: number
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(x, 1 - w)),
    y: Math.max(0, Math.min(y, 1 - h)),
  }
}

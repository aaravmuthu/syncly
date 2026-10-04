let measure: CanvasRenderingContext2D | null = null;

const TEXTUAL = new Set(["", "text", "email", "search", "tel", "url", "password", "number"]);

/**
 * Where a person is working on an element, in viewport coordinates: the caret
 * for a text field, the thumb for a slider, otherwise the middle. The avatar
 * looks here, so it follows what you are typing rather than just the pointer.
 */
export function gazePoint(el: Element): { x: number; y: number } | null {
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  const y = r.top + r.height / 2;

  if (el instanceof HTMLInputElement) {
    if (el.type === "range") {
      const min = Number(el.min) || 0;
      const span = (Number(el.max) || 100) - min || 1;
      const f = Math.min(Math.max((Number(el.value) - min) / span, 0), 1);
      return { x: r.left + r.width * f, y };
    }
    if (TEXTUAL.has(el.type)) {
      measure ??= document.createElement("canvas").getContext("2d");
      if (measure) {
        const style = getComputedStyle(el);
        measure.font = style.font;
        // Email and number inputs do not expose a caret; the end of the text is
        // where it is anyway while someone types.
        const caret = el.selectionStart ?? el.value.length;
        const text = measure.measureText(el.value.slice(0, caret)).width;
        const left = parseFloat(style.paddingLeft) || 0;
        const right = parseFloat(style.paddingRight) || 0;
        const inner = Math.max(el.clientWidth - left - right, 0);
        return { x: r.left + left + Math.min(text, inner), y };
      }
    }
  }
  return { x: r.left + r.width / 2, y };
}

/** Where the caret sits along an input, from -1 (left edge) to 1 (right edge). */
export function caretLook(input: HTMLInputElement): number {
  const caret = input.selectionStart ?? input.value.length;
  const style = getComputedStyle(input);
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return 0;
  ctx.font = style.font;
  const text = ctx.measureText(input.value.slice(0, caret)).width;
  const inner = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  if (inner <= 0) return 0;
  return Math.min(Math.max(text / inner, 0), 1) * 2 - 1;
}

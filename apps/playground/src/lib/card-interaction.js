export const CLICK_MAX_MS = 500;
export const CLICK_MAX_DISTANCE = 8;

export function beginPress(event) {
  return {
    x: event.clientX,
    y: event.clientY,
    time: Date.now(),
    pointerId: event.pointerId,
  };
}

/** 只有短按且几乎不移动才算单击；拖拽/长按返回 false。 */
export function isSingleClick(press, event) {
  if (!press) return false;
  if (
    press.pointerId !== undefined &&
    event.pointerId !== undefined &&
    press.pointerId !== event.pointerId
  ) {
    return false;
  }
  const duration = Date.now() - press.time;
  const distance = Math.hypot(event.clientX - press.x, event.clientY - press.y);
  return duration <= CLICK_MAX_MS && distance <= CLICK_MAX_DISTANCE;
}

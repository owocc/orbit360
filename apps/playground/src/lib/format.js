export function signedAngle(angle) {
  return ((Number(angle) + 180) % 360 + 360) % 360 - 180;
}

export function displayAngle(angle) {
  return Math.round(signedAngle(angle)).toString();
}

export function hintForAxis(axis) {
  return axis === 'y'
    ? '上下拖拽旋转 · 前后倾斜手机'
    : '左右拖拽旋转 · 倾斜手机环视';
}

export function ringLabelForAxis(axis) {
  return axis === 'y' ? 'PITCH' : 'BEARING';
}

export function frameLabel(frame) {
  if (!frame || !frame.count) return '— / —';
  return `帧 ${frame.index + 1} / ${frame.count} · ${frame.frameDeg.toFixed(2)}°/帧`;
}

export function ringGeometry(angle) {
  const signed = signedAngle(angle);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  return {
    signed,
    needle: angle,
    dash: `${(circumference * (signed + 180) / 360).toFixed(2)} ${circumference.toFixed(2)}`,
  };
}

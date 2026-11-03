const PREFIX = 'orbit' + '360.';
const AUTO_KEY = `${PREFIX}auto`;
const AUTO_SPEED_KEY = `${PREFIX}autoSpeed`;
const QUALITY_KEY = `${PREFIX}quality`;

export function readPref(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePref(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 隐私模式 */
  }
}

export function readQualityPref() {
  return readPref(QUALITY_KEY);
}

export function writeQualityPref(quality) {
  writePref(QUALITY_KEY, quality);
}

export function readUserConfig() {
  const config = {};
  const auto = readPref(AUTO_KEY);
  if (auto) {
    config.auto = {
      enabled: auto !== 'off',
      dir: auto === 'ccw' ? 'ccw' : 'cw',
    };
  }
  const speed = Number.parseFloat(readPref(AUTO_SPEED_KEY));
  if (Number.isFinite(speed)) {
    config.auto = { ...(config.auto || {}), degPerSec: speed };
  }
  return config;
}

export function writeAutoPref(state, speed) {
  writePref(AUTO_KEY, state);
  if (speed !== undefined) writePref(AUTO_SPEED_KEY, String(speed));
}

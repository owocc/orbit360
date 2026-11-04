import React, { useEffect, useRef } from "react";
import { Client } from "@orbit360/javascript/web-client";
import { getMaterialBlob } from "../lib/materials";

/* ══ Folding bill ═════════════════════════════════════════
   A one-dollar bill blown in glass that you can take hold of:
   drag it and it bends after your hand, fold a corner over and
   it creases, let go and it eases flat and floats back.

   ── IT IS CLOTH ─────────────────────────────────────────
   The bill is a grid of points joined by springs that hold
   their length — along the grid, across its diagonals, and
   two points apart for bending — integrated with Verlet and
   relaxed a dozen times a frame. Nothing about folding is
   written anywhere: take hold of one point and move it, and
   the rest follow because the springs will not stretch. The
   bending springs are the Stiffness knob, paper at one end and
   silk at the other.

   ── AND IT WANTS TO BE FLAT ─────────────────────────────
   Every point is pulled, gently, toward where it sits on a flat
   bill in the middle of the frame. Held, that pull nearly lets
   go so the hand wins; released, it smooths the folds out and
   brings the bill home, at the rate Settle sets.

   ── 3D ROTATION & FULL COLOUR TEXTURE ───────────────────
   Not a grey engraving: the texture is directly mapped with
   full-colour real-time pixels from the Orbit360 Web SDK.
   Dragging the bill also spins the 360° frame sequence, so
   you inspect and fold the real 3D entity simultaneously. */

export const BILL_W = 340;
export const BILL_H = 240;
/* how far past its box the canvas reaches, as a multiple of it */
const SPILL = 2;

/* the sheet: points across and down, size, how far the camera
   stands, and how it is tipped to the light */
const SPEC = {
  nx: 46,
  ny: 20,
  w: 3.0,
  h: 3.0 / 2.35,
  cam: 3.95,
  tilt: [-0.32, 0.22, -0.06],
  fw: BILL_W,
  fh: BILL_H,
};

/* how far a point may be pulled from its place before the pull goes
   to rubber, and how sharp a fold may get (a bend link's shortest,
   as a share of its length) */
const REACH = 1.5;
const CREASE = 0.55;

/* the corners */
const CORNER = 0.09;

/* the outline as a mask: white inside, clear outside */
function outline(W, H) {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#000";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#fff";
  g.beginPath();
  g.roundRect(0, 0, W, H, CORNER * H);
  g.fill();
  return c;
}

/* a studio for the glass/cloth to reflect */
function studio(THREE, pmrem) {
  const room = new THREE.Scene();
  room.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(40, 40, 40),
      new THREE.MeshBasicMaterial({ color: 0x1c2026, side: THREE.BackSide }),
    ),
  );
  const panel = (w, h, x, y, z, glow) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color().setScalar(glow),
        side: THREE.DoubleSide,
      }),
    );
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    room.add(m);
  };
  panel(14, 5, -4, 9, 9, 3.2);
  panel(3, 16, 12, 0, 6, 2.4);
  panel(16, 3, 0, -10, 6, 1.2);
  panel(20, 20, 0, 0, 16, 0.55);
  panel(10, 10, -12, 2, 2, 0.8);
  return pmrem.fromScene(room, 0.03).texture;
}

export function FoldingBill({ stiffness = 38, settle = 12, materialId = "maid" } = {}) {
  const host = useRef(null);
  const live = useRef({ stiffness, settle, materialId });
  live.current = { stiffness, settle, materialId };
  const spec = SPEC;

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    let undo = () => {};
    let gone = false;
    void import("three").then((THREE) => {
      if (gone) return;
      undo = mount(THREE, el);
    });
    return () => {
      gone = true;
      undo();
    };
  }, []);

  function mount(THREE, el) {
    const light = window.matchMedia("(pointer: coarse), (max-width: 760px)").matches;
    const renderer = new THREE.WebGLRenderer({ antialias: !light, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, light ? 1.25 : 2));
    renderer.setSize(spec.fw * SPILL, spec.fh * SPILL, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    const cv = renderer.domElement;
    cv.className = "fbill-gl";
    cv.dataset.ink = "false";
    Object.assign(cv.style, {
      width: `${SPILL * 100}%`,
      height: `${SPILL * 100}%`,
      left: `${(-(SPILL - 1) / 2) * 100}%`,
      top: `${(-(SPILL - 1) / 2) * 100}%`,
    });
    el.appendChild(cv);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = studio(THREE, pmrem);
    const camera = new THREE.PerspectiveCamera(
      (2 * Math.atan(SPILL * Math.tan((15 * Math.PI) / 180)) * 180) / Math.PI,
      spec.fw / spec.fh,
      0.1,
      50,
    );
    camera.position.set(0, 0, spec.cam);
    const { nx: NX, ny: NY, w: BW, h: BH } = spec;

    /* ── the sheet geometry ── */
    const geo = new THREE.PlaneGeometry(BW, BH, NX - 1, NY - 1);
    const P = geo.attributes.position;
    const N = P.count;
    const rest = new Float32Array(P.array);
    const pos = new Float32Array(rest);
    const prev = new Float32Array(rest);

    const links = [];
    const id = (i, j) => j * NX + i;
    const add = (a, b, k) => {
      const dx = rest[a * 3] - rest[b * 3],
        dy = rest[a * 3 + 1] - rest[b * 3 + 1];
      links.push({ a, b, len: Math.hypot(dx, dy), k });
    };
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        if (i < NX - 1) add(id(i, j), id(i + 1, j), 1);
        if (j < NY - 1) add(id(i, j), id(i, j + 1), 1);
        if (i < NX - 1 && j < NY - 1) {
          add(id(i, j), id(i + 1, j + 1), 0.7);
          add(id(i + 1, j), id(i, j + 1), 0.7);
        }
        if (i < NX - 2) add(id(i, j), id(i + 2, j), -1);
        if (j < NY - 2) add(id(i, j), id(i, j + 2), -1);
      }

    /* ── 3D Full Colour Texture via Hidden Canvas ── */
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = 1280;
    textureCanvas.height = 720;
    const textureContainer = document.createElement("div");
    textureContainer.style.width = "1280px";
    textureContainer.style.height = "720px";
    textureContainer.style.position = "absolute";
    textureContainer.style.left = "-9999px";
    textureContainer.appendChild(textureCanvas);
    document.body.appendChild(textureContainer);

    let orbitClient = null;
    let textureNeedsUpdate = true;

    try {
      orbitClient = new Client(textureCanvas, {
        container: textureContainer,
        input: textureContainer,
        config: {
          video: { fit: "cover" },
          auto: { enabled: true, degPerSec: 15 },
          drag: { degPerPx: 0.45 },
        },
        autoStartGyro: false,
      });

      orbitClient.on("frame", () => {
        textureNeedsUpdate = true;
      });

      void getMaterialBlob(live.current.materialId).then((blob) => {
        if (!disposed && orbitClient) {
          orbitClient.load(blob);
        }
      });
    } catch {
      /* ignore */
    }

    const colorTexture = new THREE.CanvasTexture(textureCanvas);
    colorTexture.colorSpace = THREE.SRGBColorSpace;
    colorTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: colorTexture,
      metalness: 0.1,
      roughness: 0.35,
      clearcoat: 0.3,
      clearcoatRoughness: 0.15,
      envMapIntensity: 0.85,
      side: THREE.DoubleSide,
    });

    const cut = new THREE.CanvasTexture(outline(512, Math.round(512 / 2.35)));
    cut.colorSpace = THREE.NoColorSpace;
    mat.alphaMap = cut;
    mat.alphaTest = 0.5;

    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.set(...spec.tilt);
    scene.add(mesh);

    /* ── the hand (supports both cloth folding and 3D angle rotation) ── */
    let held = -1;
    let holdZ = 0;
    let lastClientX = 0;
    const target = new THREE.Vector3();
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    const toNdc = (e) => {
      const r = cv.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };

    const aim = () => {
      ray.setFromCamera(ndc, camera);
      const t = (holdZ - ray.ray.origin.z) / ray.ray.direction.z;
      target.copy(ray.ray.direction).multiplyScalar(t).add(ray.ray.origin);
      mesh.worldToLocal(target);

      if (held >= 0) {
        const k = held * 3;
        const dx = target.x - rest[k],
          dy = target.y - rest[k + 1],
          dz = target.z - rest[k + 2];
        const d = Math.hypot(dx, dy, dz);
        if (d > REACH) {
          const f = (REACH + (d - REACH) * 0.2) / d;
          target.set(rest[k] + dx * f, rest[k + 1] + dy * f, rest[k + 2] + dz * f);
        }
      }
    };

    const down = (e) => {
      toNdc(e);
      lastClientX = e.clientX;
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObject(mesh)[0];
      cv.dataset.ink = String(!!hit);
      if (!hit) return;
      const local = mesh.worldToLocal(hit.point.clone());
      let best = -1,
        bd = Infinity;
      for (let n = 0; n < N; n++) {
        const d =
          (pos[n * 3] - local.x) ** 2 +
          (pos[n * 3 + 1] - local.y) ** 2 +
          (pos[n * 3 + 2] - local.z) ** 2;
        if (d < bd) {
          bd = d;
          best = n;
        }
      }
      held = best;
      holdZ = hit.point.z;
      touched = performance.now();
      flutter = 1;
      calm = 0;
      aim();
      cv.dataset.held = "true";
      try {
        cv.setPointerCapture(e.pointerId);
      } catch {
        /* scripted */
      }
      wake();
    };

    const move = (e) => {
      toNdc(e);
      if (held >= 0) {
        aim();
        // 拖动时驱动内部 360° 模型进行全角度旋转
        const deltaX = e.clientX - lastClientX;
        lastClientX = e.clientX;
        if (orbitClient && Math.abs(deltaX) > 0.5) {
          const curAngle = orbitClient.getAngle?.() || 0;
          orbitClient.setAngle?.(curAngle + deltaX * 0.8);
          textureNeedsUpdate = true;
        }
      } else {
        ray.setFromCamera(ndc, camera);
        const on = ray.intersectObject(mesh).length > 0;
        cv.dataset.over = on ? "true" : "";
        cv.dataset.ink = String(on);
      }
    };

    const up = (e) => {
      if (held < 0) return;
      held = -1;
      cv.dataset.held = "";
      try {
        cv.releasePointerCapture(e.pointerId);
      } catch {
        /* never captured */
      }
    };

    cv.addEventListener("pointerdown", down);
    cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);

    /* ── the loop ── */
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let seen = true;
    let running = false;
    let last = performance.now();
    let clock = 0;
    const H = 1 / 120;
    const PASSES = light ? 9 : 16;
    let touched = performance.now();
    let flutter = 1;
    let calm = 0;

    const step = () => {
      const { stiffness: st, settle: se } = live.current;
      const bend = 0.04 + (st / 100) * 0.5;
      const home = (0.3 + (se / 100) * 7) * (held >= 0 ? 0.04 : 1);
      for (let n = 0; n < N; n++) {
        const k = n * 3;
        const rx = rest[k],
          ry = rest[k + 1];
        const rz =
          Math.sin(rx * 1.25 + 0.6) * 0.16 +
          Math.cos(ry * 2.2) * 0.04 +
          (still ? 0 : Math.sin(clock * 1.3 + rx * 1.7 + ry * 0.8) * 0.035 * flutter);
        for (let c = 0; c < 3; c++) {
          const p = pos[k + c];
          const v = (p - prev[k + c]) * 0.982;
          const want = c === 0 ? rx : c === 1 ? ry : rz;
          prev[k + c] = p;
          pos[k + c] = p + v + (want - p) * home * H * H * 60;
        }
      }
      if (held >= 0) {
        const k = held * 3;
        pos[k] = target.x;
        pos[k + 1] = target.y;
        pos[k + 2] = target.z;
      }
      for (let it = 0; it < PASSES; it++) {
        for (const l of links) {
          const a = l.a * 3,
            b = l.b * 3;
          const dx = pos[b] - pos[a],
            dy = pos[b + 1] - pos[a + 1],
            dz = pos[b + 2] - pos[a + 2];
          const d = Math.hypot(dx, dy, dz) || 1e-6;
          let w = ((l.k < 0 ? bend : l.k) * 0.5 * (d - l.len)) / d;
          if (l.k < 0 && d < l.len * CREASE) w = (0.5 * (d - l.len * CREASE)) / d;
          const pa = l.a === held ? 0 : 1,
            pb = l.b === held ? 0 : 1;
          const s = pa + pb || 1;
          pos[a] += dx * w * ((2 * pa) / s);
          pos[a + 1] += dy * w * ((2 * pa) / s);
          pos[a + 2] += dz * w * ((2 * pa) / s);
          pos[b] -= dx * w * ((2 * pb) / s);
          pos[b + 1] -= dy * w * ((2 * pb) / s);
          pos[b + 2] -= dz * w * ((2 * pb) / s);
        }
      }
    };

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;

      if (textureNeedsUpdate) {
        colorTexture.needsUpdate = true;
        textureNeedsUpdate = false;
      }

      if (held >= 0) touched = now;
      const idle = (now - touched) / 1000;
      if (light) flutter = Math.max(0, Math.min(1, 1 - (idle - 2) / 1.5));
      if (still) flutter = 0;
      const n = Math.max(1, Math.round(dt / H));
      for (let s = 0; s < n; s++) step();

      let moved = 0;
      for (let k = 0; k < pos.length; k++) moved = Math.max(moved, Math.abs(pos[k] - prev[k]));
      calm = held < 0 && moved < 2e-4 ? calm + 1 : 0;
      P.array.set(pos);
      P.needsUpdate = true;
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      renderer.render(scene, camera);

      const sleep = (light || still) && flutter === 0 && calm > 20;
      if ((seen && !(light || still)) || (seen && !sleep)) raf = requestAnimationFrame(frame);
      else running = false;
    };

    const wake = () => {
      if (running || !seen) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const io = new IntersectionObserver(([row]) => {
      seen = row.isIntersecting;
      if (seen) wake();
    });
    io.observe(el);
    wake();

    let disposed = false;

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      cv.removeEventListener("pointerdown", down);
      cv.removeEventListener("pointermove", move);
      cv.removeEventListener("pointerup", up);
      cv.removeEventListener("pointercancel", up);
      disposed = true;
      orbitClient?.destroy?.();
      textureContainer.remove();
      colorTexture.dispose();
      geo.dispose();
      mat.dispose();
      cut.dispose();
      scene.environment?.dispose();
      pmrem.dispose();
      renderer.dispose();
      cv.remove();
    };
  }

  return <div ref={host} className="fbill" style={{ width: spec.fw, height: spec.fh }} />;
}

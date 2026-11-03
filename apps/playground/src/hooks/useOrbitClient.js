import { useCallback, useEffect, useRef, useState } from 'react';
import { Client } from '@orbit360/javascript/web-client';

const EMPTY_FRAME = { index: 0, count: 0, frameDeg: 1 };

/**
 * 管理渲染核心的生命周期、状态镜像和加载入口。
 * canvasRef / stageRef 挂到 DOM 后再创建 client。
 */
export function useOrbitClient({
  config,
  onReady,
  onGyroChange,
  onLongpress,
  onDoubletap,
}) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const clientRef = useRef(null);
  const callbacks = useRef({});

  const [state, setState] = useState(null);
  const [angle, setAngle] = useState(0);
  const [frame, setFrame] = useState(EMPTY_FRAME);
  const [progress, setProgress] = useState({ progress: 0, phase: 'idle', loaded: 0, total: 0 });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  callbacks.current = { onReady, onGyroChange, onLongpress, onDoubletap };

  useEffect(() => {
    if (!canvasRef.current || !stageRef.current) return undefined;

    const client = new Client(canvasRef.current, {
      container: stageRef.current,
      input: stageRef.current,
      config,
      autoStartGyro: true,
    });
    clientRef.current = client;

    const offs = [
      client.on('state', next => setState(next)),
      client.on('angle', event => setAngle(event.angle)),
      client.on('frame', next => setFrame(next)),
      client.on('progress', next => setProgress(next)),
      client.on('ready', ({ state: next }) => {
        setReady(true);
        setState(next);
        setAngle(next.angle);
        setFrame({
          index: next.frameIndex,
          count: next.frameCount,
          frameDeg: next.frameDeg,
        });
        callbacks.current.onReady?.(next);
      }),
      client.on('error', err => setError(err)),
      client.on('gyrochange', event => {
        callbacks.current.onGyroChange?.(event, client.getState());
      }),
      client.on('longpress', () => callbacks.current.onLongpress?.()),
      client.on('doubletap', () => callbacks.current.onDoubletap?.()),
    ];

    return () => {
      offs.forEach(off => off());
      client.destroy();
      clientRef.current = null;
    };
    // client 只在挂载时创建；后续配置都走 client API。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async (source, options) => {
    setError(null);
    setReady(false);
    return clientRef.current.load(source, options);
  }, []);

  return {
    canvasRef,
    stageRef,
    clientRef,
    state,
    angle,
    frame,
    progress,
    ready,
    error,
    load,
  };
}

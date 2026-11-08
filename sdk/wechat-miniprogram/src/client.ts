/* WeChat mini program platform adapter for the shared mini program client. */
import {
  MiniOrbitClient,
  VERSION,
  DEFAULTS,
  queryCanvas as queryMiniCanvas,
  type MiniCanvasNode,
  type MiniClientOptions,
  type MiniProgramApi,
  type MiniProgramPlatform,
} from "../../miniprogram/src/client";

const platform: MiniProgramPlatform = {
  name: "wechat",
  // The WeChat global is injected by the runtime and matches this structural API.
  api: (globalThis as { wx?: MiniProgramApi }).wx as MiniProgramApi,
  localPathPrefixes: ["wxfile://", "http://tmp/", "http://usr/", "http://store/", "http://disk/"],
  now: () => Date.now(),
};

export class Orbit360Client extends MiniOrbitClient {
  constructor(canvas: MiniCanvasNode, options: MiniClientOptions = {}) {
    super(canvas, options, platform);
  }
}

export function queryCanvas(
  options: MiniClientOptions = {},
): Promise<{ node: MiniCanvasNode; width?: number; height?: number }> {
  return queryMiniCanvas(platform, options);
}

export async function createClient(options: MiniClientOptions = {}): Promise<Orbit360Client> {
  if (options.canvas) {
    return new Orbit360Client(options.canvas, {
      ...options,
      width: options.width || options.canvas._width,
      height: options.height || options.canvas._height,
    });
  }
  const info = await queryCanvas(options);
  return new Orbit360Client(info.node, {
    ...options,
    width: info.width || options.width,
    height: info.height || options.height,
  });
}

export { DEFAULTS, VERSION, MiniOrbitClient };
export type {
  MiniClientOptions,
  MiniClientState,
  MiniCanvasNode,
  MiniProgramApi,
  MiniProgramPlatform,
} from "../../miniprogram/src/client";
export default Orbit360Client;

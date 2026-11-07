export type OrbErrorCode =
  | "ORB_TRUNCATED_HEADER"
  | "ORB_INVALID_MAGIC"
  | "ORB_UNSUPPORTED_VERSION"
  | "ORB_INVALID_INDEX_ENTRY_SIZE"
  | "ORB_INVALID_FRAME_COUNT"
  | "ORB_INVALID_INDEX_LENGTH"
  | "ORB_INVALID_PREFIX_LENGTH"
  | "ORB_TRUNCATED_PREFIX"
  | "ORB_INVALID_META_JSON"
  | "ORB_INVALID_META"
  | "ORB_INVALID_FORMAT"
  | "ORB_INVALID_META_VERSION"
  | "ORB_INVALID_CANVAS"
  | "ORB_FRAME_COUNT_MISMATCH"
  | "ORB_INVALID_CODEC"
  | "ORB_INVALID_VIDEOS"
  | "ORB_INVALID_ORBIT"
  | "ORB_INVALID_AXIS"
  | "ORB_INVALID_DIRECTION"
  | "ORB_INVALID_SPAN"
  | "ORB_INVALID_ANGLE_RANGE"
  | "ORB_INVALID_VIDEO_ORBIT"
  | "ORB_INVALID_INDEX_START"
  | "ORB_INVALID_RECT"
  | "ORB_INVALID_INDEX"
  | "ORB_TRUNCATED_FRAME"
  | "ORB_INVALID_ARGUMENT";

export class OrbError extends Error {
  code: OrbErrorCode;
  offset?: number;

  constructor(code: OrbErrorCode, message: string, offset?: number) {
    super(message);
    this.name = "OrbError";
    this.code = code;
    this.offset = offset;
  }
}

export function fail(code: OrbErrorCode, message: string, offset?: number): never {
  throw new OrbError(code, message, offset);
}

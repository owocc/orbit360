package orbit360

import (
	"encoding/json"
	"fmt"
	"math"
)

const (
	HeaderSize  = 32
	EntrySize   = 16
	Format      = "orbit360.bundle"
	Version     = uint32(0x00010002)
	MetaVersion = 1.2
)

type Header struct {
	Version        uint32
	PrefixLen      uint32
	MetaLen        uint32
	IndexLen       uint32
	FrameCount     uint32
	IndexEntrySize uint32
	Flags          uint32
}

type OrbitMeta struct {
	Axis      string
	SpanDeg   float64
	Direction string
	MinAngle  float64
	MaxAngle  float64
}

type Canvas struct {
	Width  int `json:"width"`
	Height int `json:"height"`
}

type Rect struct {
	X      int `json:"x"`
	Y      int `json:"y"`
	Width  int `json:"width"`
	Height int `json:"height"`
}

type VideoFrames struct {
	Count      int
	Width      int
	Height     int
	FPS        float64
	IndexStart int
}

type VideoMeta struct {
	ID     string
	Rect   Rect
	Orbit  OrbitMeta
	Frames VideoFrames
}

type Meta struct {
	Format       string
	Version      float64
	Title        string
	Canvas       Canvas
	TotalFrames  int
	Codec        string
	InitialAngle float64
	Orbit        OrbitMeta
	Videos       []VideoMeta
	Raw          map[string]any
}

type FrameEntry struct {
	Video  uint32
	Length uint32
	Offset uint64
}

type VideoLayer struct {
	VideoIndex int
	Rect       Rect
	FrameCount int
	IndexStart int
}

type Bundle struct {
	Header      Header
	Meta        Meta
	Entries     []FrameEntry
	Layers      []VideoLayer
	Size        int
	SceneConfig map[string]any
	data        []byte
}

type OrbError struct {
	Code    string
	Message string
	Offset  int
}

func (e *OrbError) Error() string {
	return fmt.Sprintf("ORB3[%s]: %s", e.Code, e.Message)
}

func orbError(code, message string) *OrbError {
	return &OrbError{Code: code, Message: message, Offset: -1}
}

func asMap(value any) (map[string]any, bool) {
	result, ok := value.(map[string]any)
	return result, ok
}

func asFloat(value any) (float64, bool) {
	number, ok := value.(float64)
	return number, ok && !math.IsNaN(number) && !math.IsInf(number, 0)
}

func asInt(value any) (int, bool) {
	number, ok := asFloat(value)
	if !ok || math.Trunc(number) != number || number < float64(math.MinInt32) || number > float64(math.MaxInt32) {
		return 0, false
	}
	return int(number), true
}

func asString(value any) (string, bool) {
	text, ok := value.(string)
	return text, ok
}

func normalizeOrbit(raw any, where string, fallback *OrbitMeta) (OrbitMeta, error) {
	base := OrbitMeta{Axis: "x", SpanDeg: 360, Direction: "cw", MinAngle: -180, MaxAngle: 180}
	if fallback != nil {
		base = *fallback
	}
	if raw == nil {
		return base, nil
	}
	values, ok := asMap(raw)
	if !ok {
		return base, orbError("ORB_INVALID_ORBIT", where+" 不是对象")
	}
	if value, present := values["axis"]; present {
		axis, ok := asString(value)
		if !ok || (axis != "x" && axis != "y") {
			return base, orbError("ORB_INVALID_AXIS", where+".axis 非法")
		}
		base.Axis = axis
	}
	if value, present := values["direction"]; present {
		direction, ok := asString(value)
		if !ok || (direction != "cw" && direction != "ccw") {
			return base, orbError("ORB_INVALID_DIRECTION", where+".direction 非法")
		}
		base.Direction = direction
	}
	if value, present := values["spanDeg"]; present {
		span, ok := asFloat(value)
		if !ok || span <= 0 || span > 360 {
			return base, orbError("ORB_INVALID_SPAN", where+".spanDeg 非法")
		}
		base.SpanDeg = span
	}
	if value, present := values["minAngle"]; present {
		minAngle, ok := asFloat(value)
		if !ok {
			return base, orbError("ORB_INVALID_ANGLE_RANGE", where+".minAngle 非法")
		}
		base.MinAngle = minAngle
	}
	if value, present := values["maxAngle"]; present {
		maxAngle, ok := asFloat(value)
		if !ok {
			return base, orbError("ORB_INVALID_ANGLE_RANGE", where+".maxAngle 非法")
		}
		base.MaxAngle = maxAngle
	}
	if base.MinAngle < -180 || base.MaxAngle > 180 || base.MinAngle >= base.MaxAngle {
		return base, orbError("ORB_INVALID_ANGLE_RANGE", where+".minAngle/maxAngle 非法")
	}
	return base, nil
}

var configKeys = []string{
	"title", "video", "orbit", "drag", "motion", "auto", "gyro", "mouseFollow", "defaults", "quality",
}

func Parse(data []byte) (*Bundle, error) {
	size := len(data)
	if size < HeaderSize {
		return nil, orbError("ORB_TRUNCATED_HEADER", "头部不足 32 字节")
	}
	if string(data[0:4]) != "ORB3" {
		return nil, orbError("ORB_INVALID_MAGIC", "magic 不是 ORB3")
	}
	header := Header{
		Version:        readUint32(data, 4),
		PrefixLen:      readUint32(data, 8),
		MetaLen:        readUint32(data, 12),
		IndexLen:       readUint32(data, 16),
		FrameCount:     readUint32(data, 20),
		IndexEntrySize: readUint32(data, 24),
		Flags:          readUint32(data, 28),
	}
	if header.Version != Version {
		return nil, orbError("ORB_UNSUPPORTED_VERSION", "不支持的版本")
	}
	if header.IndexEntrySize != EntrySize {
		return nil, orbError("ORB_INVALID_INDEX_ENTRY_SIZE", "不支持的索引项大小")
	}
	if header.FrameCount == 0 {
		return nil, orbError("ORB_INVALID_FRAME_COUNT", "frameCount 为 0")
	}
	if header.IndexLen != header.FrameCount*EntrySize {
		return nil, orbError("ORB_INVALID_INDEX_LENGTH", "indexLen 与 frameCount 不一致")
	}
	if header.PrefixLen != HeaderSize+header.MetaLen+header.IndexLen {
		return nil, orbError("ORB_INVALID_PREFIX_LENGTH", "prefixLen 不一致")
	}
	if uint32(size) < header.PrefixLen {
		return nil, orbError("ORB_TRUNCATED_PREFIX", "Header/Meta/Index 不完整")
	}

	metaBytes := data[HeaderSize : HeaderSize+int(header.MetaLen)]
	var parsed any
	if err := json.Unmarshal(metaBytes, &parsed); err != nil {
		return nil, orbError("ORB_INVALID_META_JSON", "meta 不是合法 JSON")
	}
	raw, ok := asMap(parsed)
	if !ok {
		return nil, orbError("ORB_INVALID_META", "meta 不是对象")
	}
	if value, ok := asString(raw["format"]); !ok || value != Format {
		return nil, orbError("ORB_INVALID_FORMAT", "meta.format 非法")
	}
	if value, ok := asFloat(raw["version"]); !ok || value != MetaVersion {
		return nil, orbError("ORB_INVALID_META_VERSION", "meta.version 非法")
	}
	canvasRaw, ok := asMap(raw["canvas"])
	if !ok {
		return nil, orbError("ORB_INVALID_CANVAS", "meta 缺少合法的 canvas")
	}
	canvasWidth, widthOK := asInt(canvasRaw["width"])
	canvasHeight, heightOK := asInt(canvasRaw["height"])
	if !widthOK || !heightOK || canvasWidth <= 0 || canvasHeight <= 0 {
		return nil, orbError("ORB_INVALID_CANVAS", "meta 缺少合法的 canvas")
	}
	totalFrames, ok := asInt(raw["totalFrames"])
	if !ok || uint32(totalFrames) != header.FrameCount {
		return nil, orbError("ORB_FRAME_COUNT_MISMATCH", "meta.totalFrames 与头部不一致")
	}
	codec, ok := asString(raw["codec"])
	if !ok || codec == "" {
		return nil, orbError("ORB_INVALID_CODEC", "meta 缺少 codec")
	}
	videosRaw, ok := raw["videos"].([]any)
	if !ok || len(videosRaw) == 0 {
		return nil, orbError("ORB_INVALID_VIDEOS", "meta 缺少 videos 数组")
	}
	sceneOrbit, err := normalizeOrbit(raw["orbit"], "meta.orbit", nil)
	if err != nil {
		return nil, err
	}

	videos := make([]VideoMeta, 0, len(videosRaw))
	layers := make([]VideoLayer, 0, len(videosRaw))
	sum := 0
	expectStart := 0
	for videoIndex, item := range videosRaw {
		videoRaw, ok := asMap(item)
		if !ok {
			return nil, orbError("ORB_INVALID_VIDEOS", "视频不是对象")
		}
		framesRaw, framesOK := asMap(videoRaw["frames"])
		rectRaw, rectOK := asMap(videoRaw["rect"])
		if !framesOK || !rectOK {
			return nil, orbError("ORB_INVALID_VIDEOS", "视频缺少 rect/frames")
		}
		count, countOK := asInt(framesRaw["count"])
		if !countOK || count <= 0 {
			return nil, orbError("ORB_INVALID_FRAME_COUNT", "视频 frames.count 非法")
		}
		indexStart, indexOK := asInt(framesRaw["indexStart"])
		if !indexOK || indexStart != expectStart {
			return nil, orbError("ORB_INVALID_INDEX_START", "视频 indexStart 不连续")
		}
		x, xOK := asInt(rectRaw["x"])
		y, yOK := asInt(rectRaw["y"])
		width, wOK := asInt(rectRaw["width"])
		height, hOK := asInt(rectRaw["height"])
		if !xOK || !yOK || !wOK || !hOK {
			return nil, orbError("ORB_INVALID_RECT", "视频 rect 不是整数")
		}
		if x < 0 || y < 0 || width <= 0 || height <= 0 ||
			x+width > canvasWidth || y+height > canvasHeight {
			return nil, orbError("ORB_INVALID_RECT", "视频 rect 越界")
		}
		videoOrbit, err := normalizeOrbit(videoRaw["orbit"], "视频 orbit", &sceneOrbit)
		if err != nil {
			return nil, err
		}
		if videoOrbit != sceneOrbit {
			return nil, orbError("ORB_INVALID_VIDEO_ORBIT", "视频 orbit 与场景不一致")
		}
		frames := VideoFrames{Count: count, IndexStart: indexStart}
		if value, ok := asInt(framesRaw["width"]); ok {
			frames.Width = value
		}
		if value, ok := asInt(framesRaw["height"]); ok {
			frames.Height = value
		}
		if value, ok := asFloat(framesRaw["fps"]); ok {
			frames.FPS = value
		}
		videos = append(videos, VideoMeta{
			ID:     stringOr(videoRaw["id"], ""),
			Rect:   Rect{X: x, Y: y, Width: width, Height: height},
			Orbit:  videoOrbit,
			Frames: frames,
		})
		layers = append(layers, VideoLayer{
			VideoIndex: videoIndex,
			Rect:       Rect{X: x, Y: y, Width: width, Height: height},
			FrameCount: count,
			IndexStart: indexStart,
		})
		expectStart += count
		sum += count
	}
	if uint32(sum) != header.FrameCount {
		return nil, orbError("ORB_FRAME_COUNT_MISMATCH", "videos 帧数之和与 frameCount 不一致")
	}

	entries := make([]FrameEntry, 0, header.FrameCount)
	expectedOffset := uint64(header.PrefixLen)
	entryIndex := 0
	for videoIndex, layer := range layers {
		for frame := 0; frame < layer.FrameCount; frame++ {
			base := HeaderSize + int(header.MetaLen) + entryIndex*EntrySize
			video := readUint32(data, base)
			length := readUint32(data, base+4)
			offset := readUint64(data, base+8)
			if offset > uint64(math.MaxInt64) {
				return nil, orbError("ORB_INVALID_INDEX", "索引 offset 超出平台范围")
			}
			if int(video) != videoIndex {
				return nil, orbError("ORB_INVALID_INDEX", "索引 video 编号不对")
			}
			if length == 0 {
				return nil, orbError("ORB_INVALID_INDEX", "索引 length 为 0")
			}
			if offset != expectedOffset {
				return nil, orbError("ORB_INVALID_INDEX", "索引 offset 不连续")
			}
			if offset > uint64(size) || uint64(length) > uint64(size)-offset {
				return nil, orbError("ORB_TRUNCATED_FRAME", "索引越界")
			}
			entries = append(entries, FrameEntry{Video: video, Length: length, Offset: offset})
			expectedOffset += uint64(length)
			entryIndex++
		}
	}
	if expectedOffset != uint64(size) {
		return nil, orbError("ORB_INVALID_INDEX", "索引与文件长度不一致")
	}

	sceneConfig := map[string]any{}
	for _, key := range configKeys {
		if value, present := raw[key]; present {
			sceneConfig[key] = value
		}
	}
	initialAngle := 0.0
	if value, ok := asFloat(raw["initialAngle"]); ok {
		initialAngle = value
	}
	return &Bundle{
		Header: header,
		Meta: Meta{
			Format:       Format,
			Version:      MetaVersion,
			Title:        stringOr(raw["title"], ""),
			Canvas:       Canvas{Width: canvasWidth, Height: canvasHeight},
			TotalFrames:  totalFrames,
			Codec:        codec,
			InitialAngle: initialAngle,
			Orbit:        sceneOrbit,
			Videos:       videos,
			Raw:          raw,
		},
		Entries:     entries,
		Layers:      layers,
		Size:        size,
		SceneConfig: sceneConfig,
		data:        data,
	}, nil
}

func (b *Bundle) FrameEntry(videoIndex, frameIndex int) (FrameEntry, error) {
	if videoIndex < 0 || videoIndex >= len(b.Layers) {
		return FrameEntry{}, orbError("ORB_INVALID_ARGUMENT", "没有视频")
	}
	layer := b.Layers[videoIndex]
	if frameIndex < 0 || frameIndex >= layer.FrameCount {
		return FrameEntry{}, orbError("ORB_INVALID_ARGUMENT", "没有该帧")
	}
	return b.Entries[layer.IndexStart+frameIndex], nil
}

func (b *Bundle) FrameBytes(videoIndex, frameIndex int) ([]byte, error) {
	entry, err := b.FrameEntry(videoIndex, frameIndex)
	if err != nil {
		return nil, err
	}
	return b.data[int(entry.Offset) : int(entry.Offset)+int(entry.Length)], nil
}

func readUint32(data []byte, offset int) uint32 {
	return uint32(data[offset]) | uint32(data[offset+1])<<8 | uint32(data[offset+2])<<16 | uint32(data[offset+3])<<24
}

func readUint64(data []byte, offset int) uint64 {
	return uint64(readUint32(data, offset)) | uint64(readUint32(data, offset+4))<<32
}

func stringOr(value any, fallback string) string {
	if text, ok := asString(value); ok {
		return text
	}
	return fallback
}

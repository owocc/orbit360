// Package orbit360 解析 ORB3（.orb）场景包，并用 MyGo 原生控件渲染。
//
// 它不依赖浏览器或 WebView：帧由 Go 解码成 ui.Bitmap，画在 MyGo 窗口里。
package orbit360

import (
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"os"
)

const (
	// Magic 是 ORB3 文件头的前四个字节。
	Magic = "ORB3"
	// HeaderSize 是固定 32 字节的文件头。
	HeaderSize = 32
	// EntrySize 是每条帧索引的字节数：<IIQ> videoIndex, length, offset。
	EntrySize = 16
	// Format 是 meta.format 的固定值。
	Format = "orbit360.bundle"

	versionMajor = 1
	versionMinor = 2
	// Version 是当前写入端的版本号（major<<16 | minor）。
	Version uint32 = versionMajor<<16 | versionMinor
)

// Axis 是环绕轴：x 为水平环绕，y 为垂直环绕。
type Axis string

const (
	AxisX Axis = "x"
	AxisY Axis = "y"
)

// Direction 是帧序列的环绕方向。
type Direction string

const (
	Clockwise        Direction = "cw"
	CounterClockwise Direction = "ccw"
)

// Orbit 是 meta 里的 orbit 字段。缺省值由 ResolveOrbit 补齐。
type Orbit struct {
	Axis      *Axis      `json:"axis,omitempty"`
	SpanDeg   *float64   `json:"spanDeg,omitempty"`
	Direction *Direction `json:"direction,omitempty"`
	MinAngle  *float64   `json:"minAngle,omitempty"`
	MaxAngle  *float64   `json:"maxAngle,omitempty"`
}

// Rect 是视频在画布上的位置与尺寸（像素）。
type Rect struct {
	X      int `json:"x"`
	Y      int `json:"y"`
	Width  int `json:"width"`
	Height int `json:"height"`
}

// Canvas 是场景画布尺寸。
type Canvas struct {
	Width  int `json:"width"`
	Height int `json:"height"`
}

// Frames 描述一个视频的帧序列。
type Frames struct {
	Count      int     `json:"count"`
	Width      int     `json:"width"`
	Height     int     `json:"height"`
	FPS        float64 `json:"fps"`
	IndexStart int     `json:"indexStart"`
}

// Video 是 meta.videos 里的一项。
type Video struct {
	ID     string          `json:"id"`
	Rect   Rect            `json:"rect"`
	Orbit  *Orbit          `json:"orbit,omitempty"`
	Frames Frames          `json:"frames"`
	Source json.RawMessage `json:"source,omitempty"`
}

// Meta 是 .orb 的 JSON 元数据。
type Meta struct {
	Format       string  `json:"format"`
	Version      float64 `json:"version"`
	Title        string  `json:"title,omitempty"`
	Canvas       Canvas  `json:"canvas"`
	TotalFrames  int     `json:"totalFrames"`
	Codec        string  `json:"codec"`
	InitialAngle float64 `json:"initialAngle,omitempty"`
	Orbit        *Orbit  `json:"orbit,omitempty"`
	Videos       []Video `json:"videos"`
}

// Header 是 32 字节文件头。
type Header struct {
	Version        uint32
	PrefixLen      uint32
	MetaLen        uint32
	IndexLen       uint32
	FrameCount     uint32
	IndexEntrySize uint32
	Flags          uint32
}

// Entry 是一条帧索引。
type Entry struct {
	Video  int
	Length int
	Offset int64
}

// Bundle 是解析完成的 .orb 场景包。Frame 按需读取帧数据。
type Bundle struct {
	Header    Header
	Meta      Meta
	Entries   []Entry
	PrefixLen int
	Size      int64

	r      io.ReaderAt
	closer io.Closer
	// resolved 是补齐缺省值后的场景环绕参数。
	resolved OrbitDefaults
}

// OrbitDefaults 是补齐缺省值后的环绕设置。
type OrbitDefaults struct {
	Axis      Axis
	SpanDeg   float64
	Direction Direction
	MinAngle  float64
	MaxAngle  float64
}

// ResolveOrbit 把缺省值补进 o：轴 x、跨度 360、方向 cw、角度 -180..180。
func ResolveOrbit(o *Orbit) (OrbitDefaults, error) {
	d := OrbitDefaults{Axis: AxisX, SpanDeg: 360, Direction: Clockwise, MinAngle: -180, MaxAngle: 180}
	if o == nil {
		return d, nil
	}
	if o.Axis != nil {
		if *o.Axis != AxisX && *o.Axis != AxisY {
			return d, fmt.Errorf("orbit.axis 只能是 x / y，收到 %q", *o.Axis)
		}
		d.Axis = *o.Axis
	}
	if o.SpanDeg != nil {
		if !finite(*o.SpanDeg) || *o.SpanDeg <= 0 {
			return d, errors.New("orbit.spanDeg 必须大于 0")
		}
		d.SpanDeg = min(360, *o.SpanDeg)
	}
	if o.Direction != nil {
		if *o.Direction != Clockwise && *o.Direction != CounterClockwise {
			return d, fmt.Errorf("orbit.direction 只能是 cw / ccw，收到 %q", *o.Direction)
		}
		d.Direction = *o.Direction
	}
	if o.MinAngle != nil {
		d.MinAngle = *o.MinAngle
	}
	if o.MaxAngle != nil {
		d.MaxAngle = *o.MaxAngle
	}
	if !finite(d.MinAngle) || !finite(d.MaxAngle) ||
		d.MinAngle < -180 || d.MaxAngle > 180 || d.MinAngle >= d.MaxAngle {
		return d, errors.New("orbit.minAngle/maxAngle 必须在 -180..180 且 min < max")
	}
	return d, nil
}

// Resolved 返回补齐缺省值后的场景环绕参数。
func (b *Bundle) Resolved() OrbitDefaults { return b.resolved }

// Open 打开并校验一个 .orb 文件。返回的 Bundle 需要 Close。
func Open(path string) (*Bundle, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	st, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, err
	}
	b, err := OpenReaderAt(f, st.Size())
	if err != nil {
		f.Close()
		return nil, err
	}
	b.closer = f
	return b, nil
}

// OpenReaderAt 从可随机读取的数据源解析 .orb（例如 HTTP Range 读取器）。
func OpenReaderAt(r io.ReaderAt, size int64) (*Bundle, error) {
	if r == nil || size < HeaderSize {
		return nil, errors.New("ORB3: 文件不足 32 字节")
	}
	head := make([]byte, HeaderSize)
	if _, err := r.ReadAt(head, 0); err != nil {
		return nil, fmt.Errorf("ORB3: 读文件头: %w", err)
	}
	h, err := parseHeader(head)
	if err != nil {
		return nil, err
	}
	if int64(h.PrefixLen) > size {
		return nil, errors.New("ORB3: 文件被截断（prefixLen 超出文件）")
	}
	prefix := make([]byte, h.PrefixLen)
	if _, err := r.ReadAt(prefix, 0); err != nil {
		return nil, fmt.Errorf("ORB3: 读 Header/Meta/Index: %w", err)
	}
	meta, entries, err := parsePrefix(prefix, h, size)
	if err != nil {
		return nil, err
	}
	resolved, err := ResolveOrbit(meta.Orbit)
	if err != nil {
		return nil, fmt.Errorf("ORB3: %w", err)
	}
	return &Bundle{
		Header:    h,
		Meta:      meta,
		Entries:   entries,
		PrefixLen: int(h.PrefixLen),
		Size:      size,
		r:         r,
		resolved:  resolved,
	}, nil
}

// Close 释放打开的文件；对 OpenReaderAt 构造的 Bundle 无副作用。
func (b *Bundle) Close() error {
	if b == nil || b.closer == nil {
		return nil
	}
	err := b.closer.Close()
	b.closer = nil
	b.r = nil
	return err
}

// FrameEntry 返回第 videoIndex 个视频的第 frameIndex 帧索引。
func (b *Bundle) FrameEntry(videoIndex, frameIndex int) (Entry, error) {
	if b == nil {
		return Entry{}, errors.New("ORB3: 场景包未打开")
	}
	if videoIndex < 0 || videoIndex >= len(b.Meta.Videos) {
		return Entry{}, fmt.Errorf("ORB3: 没有视频 %d", videoIndex)
	}
	v := b.Meta.Videos[videoIndex]
	if frameIndex < 0 || frameIndex >= v.Frames.Count {
		return Entry{}, fmt.Errorf("ORB3: 视频 %d 没有第 %d 帧", videoIndex, frameIndex)
	}
	e := b.Entries[v.Frames.IndexStart+frameIndex]
	return e, nil
}

// Frame 读取一帧的原始编码数据（WebP / JPEG / PNG …）。
func (b *Bundle) Frame(videoIndex, frameIndex int) ([]byte, error) {
	e, err := b.FrameEntry(videoIndex, frameIndex)
	if err != nil {
		return nil, err
	}
	if b.r == nil {
		return nil, errors.New("ORB3: 场景包已关闭")
	}
	buf := make([]byte, e.Length)
	if _, err := b.r.ReadAt(buf, e.Offset); err != nil {
		return nil, fmt.Errorf("ORB3: 读第 %d 帧: %w", frameIndex, err)
	}
	return buf, nil
}

// Count 返回场景里最多那个视频的帧数（用于角度→帧号映射）。
func (b *Bundle) Count() int {
	count := 0
	for _, v := range b.Meta.Videos {
		count = max(count, v.Frames.Count)
	}
	return count
}

func parseHeader(head []byte) (Header, error) {
	if string(head[:4]) != Magic {
		return Header{}, errors.New("ORB3: magic 不是 ORB3")
	}
	h := Header{
		Version:        binary.LittleEndian.Uint32(head[4:]),
		PrefixLen:      binary.LittleEndian.Uint32(head[8:]),
		MetaLen:        binary.LittleEndian.Uint32(head[12:]),
		IndexLen:       binary.LittleEndian.Uint32(head[16:]),
		FrameCount:     binary.LittleEndian.Uint32(head[20:]),
		IndexEntrySize: binary.LittleEndian.Uint32(head[24:]),
		Flags:          binary.LittleEndian.Uint32(head[28:]),
	}
	if h.Version != Version && h.Version != 0x00010001 && h.Version != 1 {
		return Header{}, fmt.Errorf("ORB3: 不支持的版本 %s（支持 1.0 / 1.1 / 1.2）", versionText(h.Version))
	}
	if h.IndexEntrySize != EntrySize {
		return Header{}, fmt.Errorf("ORB3: 不支持的索引项大小 %d", h.IndexEntrySize)
	}
	if h.FrameCount == 0 {
		return Header{}, errors.New("ORB3: frameCount 为 0")
	}
	if h.IndexLen != h.FrameCount*EntrySize {
		return Header{}, errors.New("ORB3: indexLen 与 frameCount 不一致")
	}
	if h.PrefixLen != HeaderSize+h.MetaLen+h.IndexLen {
		return Header{}, errors.New("ORB3: prefixLen 不一致")
	}
	if h.MetaLen == 0 {
		return Header{}, errors.New("ORB3: metaLen 为 0")
	}
	return h, nil
}

func parsePrefix(prefix []byte, h Header, size int64) (Meta, []Entry, error) {
	if len(prefix) < int(h.PrefixLen) {
		return Meta{}, nil, errors.New("ORB3: Header/Meta/Index 不完整")
	}
	var meta Meta
	metaBytes := prefix[HeaderSize : HeaderSize+h.MetaLen]
	if err := json.Unmarshal(metaBytes, &meta); err != nil {
		return Meta{}, nil, fmt.Errorf("ORB3: meta 不是合法 JSON: %w", err)
	}
	if meta.Format != Format {
		return Meta{}, nil, fmt.Errorf("ORB3: meta.format 不是 %s", Format)
	}
	if meta.Canvas.Width <= 0 || meta.Canvas.Height <= 0 {
		return Meta{}, nil, errors.New("ORB3: meta 缺少合法的 canvas.width/height")
	}
	if meta.TotalFrames != int(h.FrameCount) {
		return Meta{}, nil, errors.New("ORB3: meta.totalFrames 与头部不一致")
	}
	if meta.Codec == "" {
		return Meta{}, nil, errors.New("ORB3: meta 缺少 codec")
	}
	if len(meta.Videos) == 0 {
		return Meta{}, nil, errors.New("ORB3: meta 缺少 videos 数组")
	}
	scene, err := ResolveOrbit(meta.Orbit)
	if err != nil {
		return Meta{}, nil, fmt.Errorf("ORB3: %w", err)
	}

	sum, expectStart := 0, 0
	for vi := range meta.Videos {
		v := &meta.Videos[vi]
		if v.Frames.Count <= 0 {
			return Meta{}, nil, fmt.Errorf("ORB3: 视频 %d 的 frames.count 非法", vi)
		}
		if v.Frames.IndexStart != expectStart {
			return Meta{}, nil, fmt.Errorf("ORB3: 视频 %d 的 indexStart 不连续", vi)
		}
		if v.Rect.Width <= 0 || v.Rect.Height <= 0 ||
			v.Rect.X < 0 || v.Rect.Y < 0 ||
			v.Rect.X+v.Rect.Width > meta.Canvas.Width ||
			v.Rect.Y+v.Rect.Height > meta.Canvas.Height {
			return Meta{}, nil, fmt.Errorf("ORB3: 视频 %d 的 rect 越界", vi)
		}
		if v.Orbit != nil {
			// 与网页客户端一致：视频缺省的 orbit 字段继承场景值，再校验一致性。
			ov := *v.Orbit
			if ov.Axis == nil {
				a := scene.Axis
				ov.Axis = &a
			}
			if ov.SpanDeg == nil {
				s := scene.SpanDeg
				ov.SpanDeg = &s
			}
			if ov.Direction == nil {
				d := scene.Direction
				ov.Direction = &d
			}
			if ov.MinAngle == nil {
				m := scene.MinAngle
				ov.MinAngle = &m
			}
			if ov.MaxAngle == nil {
				m := scene.MaxAngle
				ov.MaxAngle = &m
			}
			vo, err := ResolveOrbit(&ov)
			if err != nil {
				return Meta{}, nil, fmt.Errorf("ORB3: 视频 %d: %w", vi, err)
			}
			if vo.Axis != scene.Axis {
				return Meta{}, nil, fmt.Errorf("ORB3: 视频 %d 的轴 %s 与场景的 %s 不一致", vi, vo.Axis, scene.Axis)
			}
			if vo.MinAngle != scene.MinAngle || vo.MaxAngle != scene.MaxAngle {
				return Meta{}, nil, fmt.Errorf("ORB3: 视频 %d 的角度限制与场景不一致", vi)
			}
		}
		expectStart += v.Frames.Count
		sum += v.Frames.Count
	}
	if sum != int(h.FrameCount) {
		return Meta{}, nil, errors.New("ORB3: videos 帧数之和与 frameCount 不一致")
	}

	entries := make([]Entry, h.FrameCount)
	expectedOff := int64(h.PrefixLen)
	e := 0
	index := prefix[HeaderSize+h.MetaLen : HeaderSize+h.MetaLen+h.IndexLen]
	for vi := range meta.Videos {
		for k := 0; k < meta.Videos[vi].Frames.Count; k++ {
			base := e * EntrySize
			ev := binary.LittleEndian.Uint32(index[base:])
			length := binary.LittleEndian.Uint32(index[base+4:])
			lo := binary.LittleEndian.Uint32(index[base+8:])
			hi := binary.LittleEndian.Uint32(index[base+12:])
			off := int64(hi)<<32 | int64(lo)
			if int(ev) != vi {
				return Meta{}, nil, fmt.Errorf("ORB3: 第 %d 条索引的 video 编号不对", e)
			}
			if length == 0 || off != expectedOff {
				return Meta{}, nil, fmt.Errorf("ORB3: 第 %d 条索引偏移不连续", e)
			}
			if off+int64(length) > size {
				return Meta{}, nil, fmt.Errorf("ORB3: 第 %d 条索引越界", e)
			}
			entries[e] = Entry{Video: int(ev), Length: int(length), Offset: off}
			expectedOff += int64(length)
			e++
		}
	}
	if expectedOff != size {
		return Meta{}, nil, errors.New("ORB3: 索引与文件长度不一致（可能被截断）")
	}
	return meta, entries, nil
}

func versionText(raw uint32) string {
	if raw == 1 {
		return "1.0"
	}
	return fmt.Sprintf("%d.%d", raw>>16, raw&0xffff)
}

func finite(v float64) bool {
	return !math.IsNaN(v) && !math.IsInf(v, 0)
}

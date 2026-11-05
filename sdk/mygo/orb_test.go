package orbit360

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"os"
	"testing"
)

func syntheticBundle(t *testing.T) []byte {
	t.Helper()
	meta := map[string]any{
		"format":       Format,
		"version":      1.2,
		"title":        "测试",
		"canvas":       map[string]int{"width": 640, "height": 360},
		"totalFrames":  2,
		"codec":        "image/webp",
		"initialAngle": 30,
		"orbit": map[string]any{
			"axis": "x", "spanDeg": 360, "direction": "cw",
			"minAngle": -120, "maxAngle": 120,
		},
		"videos": []any{
			map[string]any{
				"id":   "v1",
				"rect": map[string]int{"x": 0, "y": 0, "width": 640, "height": 360},
				"frames": map[string]any{
					"count": 2, "width": 640, "height": 360, "fps": 12, "indexStart": 0,
				},
			},
		},
	}
	metaBytes, err := json.Marshal(meta)
	if err != nil {
		t.Fatal(err)
	}
	frames := [][]byte{[]byte("frame-0"), []byte("frame-1")}
	prefixLen := HeaderSize + len(metaBytes) + len(frames)*EntrySize
	out := make([]byte, HeaderSize, prefixLen+len(frames[0])+len(frames[1]))
	copy(out, Magic)
	binary.LittleEndian.PutUint32(out[4:], Version)
	binary.LittleEndian.PutUint32(out[8:], uint32(prefixLen))
	binary.LittleEndian.PutUint32(out[12:], uint32(len(metaBytes)))
	binary.LittleEndian.PutUint32(out[16:], uint32(len(frames)*EntrySize))
	binary.LittleEndian.PutUint32(out[20:], uint32(len(frames)))
	binary.LittleEndian.PutUint32(out[24:], EntrySize)
	out = append(out, metaBytes...)
	off := prefixLen
	for i, f := range frames {
		entry := make([]byte, EntrySize)
		binary.LittleEndian.PutUint32(entry[0:], 0)
		binary.LittleEndian.PutUint32(entry[4:], uint32(len(f)))
		binary.LittleEndian.PutUint32(entry[8:], uint32(off))
		binary.LittleEndian.PutUint32(entry[12:], 0)
		out = append(out, entry...)
		off += len(f)
		_ = i
	}
	for _, f := range frames {
		out = append(out, f...)
	}
	return out
}

func TestOpenReaderAt(t *testing.T) {
	data := syntheticBundle(t)
	b, err := OpenReaderAt(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatal(err)
	}
	if b.Meta.Title != "测试" || b.Count() != 2 {
		t.Fatalf("meta/count 不对: %+v %d", b.Meta, b.Count())
	}
	o := b.Resolved()
	if o.Axis != AxisX || o.MinAngle != -120 || o.MaxAngle != 120 {
		t.Fatalf("orbit 不对: %+v", o)
	}
	f, err := b.Frame(0, 1)
	if err != nil {
		t.Fatal(err)
	}
	if string(f) != "frame-1" {
		t.Fatalf("帧内容不对: %q", f)
	}
	if _, err := b.Frame(0, 2); err == nil {
		t.Fatal("越界帧应报错")
	}
}

func TestRejectsBadMagicAndTruncation(t *testing.T) {
	data := syntheticBundle(t)
	bad := append([]byte(nil), data...)
	bad[0] = 'X'
	if _, err := OpenReaderAt(bytes.NewReader(bad), int64(len(bad))); err == nil {
		t.Fatal("坏 magic 应报错")
	}
	if _, err := OpenReaderAt(bytes.NewReader(data), int64(len(data)-1)); err == nil {
		t.Fatal("截断文件应报错")
	}
}

func TestOpenAsset(t *testing.T) {
	path := "../../assets/orbit/scene.orb"
	if _, err := os.Stat(path); err != nil {
		t.Skip("仓库示例不在")
	}
	b, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer b.Close()
	if b.Meta.Title == "" || b.Count() == 0 {
		t.Fatalf("示例 meta 不完整: %+v", b.Meta)
	}
	if _, err := b.Frame(0, b.Count()-1); err != nil {
		t.Fatal(err)
	}
}

func TestFrameIndexAndBounds(t *testing.T) {
	data := syntheticBundle(t)
	b, err := OpenReaderAt(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatal(err)
	}
	c := NewClient(b)
	if c.Angle() != 30 {
		t.Fatalf("初始角度: %v", c.Angle())
	}
	c.SetAngle(500)
	if c.target != 120 {
		t.Fatalf("有限区间应钳制到 120，得到 %v", c.target)
	}
	c.SetAngle(-500)
	if c.target != -120 {
		t.Fatalf("有限区间应钳制到 -120，得到 %v", c.target)
	}
	c.angle = 0
	if got := c.frameIndexLocked(); got != 0 {
		t.Fatalf("角度 0 的帧号: %d", got)
	}
	c.angle = 120
	if got := c.frameIndexLocked(); got != 1 {
		t.Fatalf("角度 120 的帧号: %d", got)
	}
}

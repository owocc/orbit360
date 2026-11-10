package orbit360

import (
	"encoding/json"
	"errors"
	"image"
	"math"
	"os"
	"path/filepath"
	"testing"

	"github.com/egoist/mygo/ui"
	core "github.com/owocc/orbit360/sdk/go"
)

const projectRoot = "../.."

// 解析行为直接跟随 conformance/parser，不维护私有 expected。
func TestParserConformance(t *testing.T) {
	dir := filepath.Join(projectRoot, "conformance", "parser")
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		var item struct {
			Name   string `json:"name"`
			File   string `json:"file"`
			Expect struct {
				Success    bool   `json:"success"`
				ErrorCode  string `json:"errorCode"`
				FrameCount int    `json:"frameCount"`
				VideoCount int    `json:"videoCount"`
			} `json:"expect"`
		}
		raw, err := os.ReadFile(filepath.Join(dir, entry.Name()))
		if err != nil {
			t.Fatal(err)
		}
		if err := json.Unmarshal(raw, &item); err != nil {
			t.Fatal(err)
		}
		data, err := os.ReadFile(filepath.Join(projectRoot, item.File))
		if err != nil {
			t.Fatal(err)
		}
		t.Run(item.Name, func(t *testing.T) {
			client := NewClient()
			defer client.Close()
			loadErr := client.Load(data)
			if item.Expect.Success {
				if loadErr != nil {
					t.Fatalf("unexpected error: %v", loadErr)
				}
				meta, ok := client.Meta()
				if !ok {
					t.Fatal("missing meta")
				}
				if len(meta.Videos) != item.Expect.VideoCount {
					t.Fatalf("videoCount = %d, want %d", len(meta.Videos), item.Expect.VideoCount)
				}
				snapshot := client.Snapshot()
				bundle := client.Bundle()
				if bundle == nil {
					t.Fatal("missing bundle")
				}
				if int(bundle.Header.FrameCount) != item.Expect.FrameCount {
					t.Fatalf("frameCount = %d, want %d", bundle.Header.FrameCount, item.Expect.FrameCount)
				}
				if snapshot.FrameCount == 0 {
					t.Fatal("engine frameCount 为 0")
				}
				return
			}
			var orbErr *core.OrbError
			if !errors.As(loadErr, &orbErr) {
				t.Fatalf("expected OrbError, got %v", loadErr)
			}
			if orbErr.Code != item.Expect.ErrorCode {
				t.Fatalf("error code = %s, want %s", orbErr.Code, item.Expect.ErrorCode)
			}
			if _, ok := client.Meta(); ok {
				t.Fatal("failed load should not keep a bundle")
			}
		})
	}
}

func examplePath(t *testing.T) string {
	t.Helper()
	path := filepath.Join(projectRoot, "assets", "orbit", "scene.orb")
	if _, err := os.Stat(path); err != nil {
		t.Skip("仓库示例不在")
	}
	return path
}

func render(t *testing.T, client *Client, width, height int) *image.RGBA {
	t.Helper()
	view := func(ctx *ui.Context) {
		client.View(ctx)
	}
	img := ui.Render(view, width, height, 1)
	if img == nil || img.Bounds().Dx() != width || img.Bounds().Dy() != height {
		t.Fatalf("渲染结果不对: %v", img)
	}
	return img
}

func uniform(img *image.RGBA) bool {
	first := img.RGBAAt(0, 0)
	for y := 0; y < img.Bounds().Dy(); y += 5 {
		for x := 0; x < img.Bounds().Dx(); x += 5 {
			if img.RGBAAt(x, y) != first {
				return false
			}
		}
	}
	return true
}

func TestViewRendersLoadedScene(t *testing.T) {
	client := NewClient(Options{Fit: FitContain, CacheSize: 4})
	defer client.Close()
	if err := client.LoadFile(examplePath(t)); err != nil {
		t.Fatal(err)
	}
	img := render(t, client, 640, 360)
	if uniform(img) {
		t.Fatal("预览页是纯色的")
	}
	snapshot := client.Snapshot()
	if snapshot.FrameCount == 0 {
		t.Fatal("frameCount 为 0")
	}
	if index := client.FrameIndex(); index < 0 || index >= snapshot.FrameCount {
		t.Fatalf("frameIndex 越界: %d", index)
	}
	if client.Error() != "" {
		t.Fatalf("解码示例失败: %s", client.Error())
	}
}

func TestEmptyView(t *testing.T) {
	client := NewClient()
	defer client.Close()
	if img := render(t, client, 240, 120); uniform(img) {
		t.Fatal("空状态应该是带提示的深色画面")
	}
}

func TestFrameCacheLimit(t *testing.T) {
	client := NewClient(Options{CacheSize: 2})
	defer client.Close()
	if err := client.LoadFile(examplePath(t)); err != nil {
		t.Fatal(err)
	}
	snapshot := client.Snapshot()
	if snapshot.FrameCount < 3 {
		t.Skip("示例帧太少")
	}
	for _, angle := range []float64{0, 120, 240} {
		client.SetAngle(angle, true)
		render(t, client, 320, 180)
	}
	if len(client.cache) > 2 || len(client.order) > 2 {
		t.Fatalf("缓存没有按上限淘汰: cache=%d order=%d", len(client.cache), len(client.order))
	}
}

func TestConfigSurvivesReload(t *testing.T) {
	client := NewClient()
	defer client.Close()
	path := examplePath(t)
	if err := client.LoadFile(path); err != nil {
		t.Fatal(err)
	}
	client.SetFit(FitCover)
	client.SetAuto(AutoCCW)
	if err := client.LoadFile(path); err != nil {
		t.Fatal(err)
	}
	if got := client.Fit(); got != FitCover {
		t.Fatalf("fit = %s, want cover", got)
	}
	if got := client.Auto(); got != AutoCCW {
		t.Fatalf("auto = %s, want ccw", got)
	}
}

func TestAngleControls(t *testing.T) {
	client := NewClient()
	defer client.Close()
	if err := client.LoadFile(examplePath(t)); err != nil {
		t.Fatal(err)
	}
	snapshot := client.Snapshot()
	angle := 90.0
	if snapshot.Limited {
		angle = snapshot.MinAngle
	}
	client.SetAngle(angle, true)
	if got := client.Angle(); math.Abs(got-angle) > 1e-6 {
		t.Fatalf("angle = %v, want %v", got, angle)
	}
	client.RotateBy(45)
	want := angle + 45
	if snapshot.Limited {
		want = math.Min(snapshot.MaxAngle, math.Max(snapshot.MinAngle, want))
	}
	if got := client.Snapshot().TargetAngle; math.Abs(got-want) > 1e-6 {
		t.Fatalf("target = %v, want %v", got, want)
	}
	client.Reset()
	initial := client.Bundle().Meta.InitialAngle
	if snapshot.Limited {
		initial = math.Min(snapshot.MaxAngle, math.Max(snapshot.MinAngle, initial))
	}
	if got := client.Snapshot().TargetAngle; math.Abs(got-initial) > 1e-6 {
		t.Fatalf("reset target = %v, want %v", got, initial)
	}
}

func TestLoadKeepsOldSceneOnError(t *testing.T) {
	client := NewClient()
	defer client.Close()
	if err := client.LoadFile(examplePath(t)); err != nil {
		t.Fatal(err)
	}
	if err := client.Load([]byte("not an orb")); err == nil {
		t.Fatal("expected error")
	}
	if _, ok := client.Meta(); !ok {
		t.Fatal("失败的加载不应丢掉当前场景")
	}
}

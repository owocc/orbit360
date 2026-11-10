package main

import (
	"image"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/egoist/mygo/ui"
	orbit360 "github.com/owocc/orbit360/sdk/mygo"
)

// 视图能在没有窗口的情况下渲染出画面，且空日志、有日志、构建中三种状态都不出错。
func TestViewRenders(t *testing.T) {
	base := func() *app {
		return &app{
			root: "/tmp", python: "/usr/bin/python3", ffmpeg: "/opt/homebrew/bin/ffmpeg",
			video: "/tmp/a.mp4", id: "gen", title: "生成视频",
			fps: 12, longEdge: 1280, quality: 80, orbitSpan: 360, initialAngle: 0,
			codec: 0, orbitDir: 0, updateCatalog: true,
		}
	}

	cases := []struct {
		name string
		set  func(a *app)
	}{
		{"empty", func(a *app) {}},
		{"running", func(a *app) {
			a.busy, a.progress = true, -1
			a.appendLog("源: a.mp4 752x416 24fps")
		}},
		{"finished", func(a *app) {
			a.lastOut, a.lastID = "/tmp/assets/gen", "gen"
			a.setStatus("完成，已切到桌面预览", false)
			a.appendLog("场景包: /tmp/assets/gen/scene.orb  1280x710  webp  120 帧  2.4 MB")
			a.appendLog("  v1: 120 帧 1280x710 @12fps 放在 (0,0) 1280x710  2.4 MB")
			a.appendLog("错误：示例")
		}},
		{"failed", func(a *app) {
			a.setStatus("找不到 ffmpeg", true)
			a.ffmpeg = ""
		}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			a := base()
			tc.set(a)
			img := ui.Render(a.view, 900, 760, 1)
			if img == nil || img.Bounds().Dx() != 900 || img.Bounds().Dy() != 760 {
				t.Fatalf("渲染结果不对: %v", img)
			}
			// 不能整屏一个颜色（说明确实画了东西）
			first := img.RGBAAt(0, 0)
			uniform := true
			for y := 0; y < 760; y += 7 {
				for x := 0; x < 900; x += 7 {
					if img.RGBAAt(x, y) != first {
						uniform = false
					}
				}
			}
			if uniform {
				t.Fatal("画面是纯色的，布局没画出来")
			}
		})
	}
}

func TestBuildArgs(t *testing.T) {
	a := &app{
		root: "/repo", python: "/usr/bin/python3", ffmpeg: "/opt/homebrew/bin/ffmpeg",
		video: "/tmp/a.mp4", id: "gen", title: "生成视频",
		fps: 12, longEdge: 1280, quality: 80, orbitSpan: 360, initialAngle: 15,
		codec: 2, orbitDir: 1, orbitAxis: 1, minAngle: -170, maxAngle: 170, updateCatalog: true,
	}
	got := strings.Join(a.buildArgs(filepath.Join("/repo", "assets", "gen", "scene.orb")), " ")
	want := strings.Join([]string{
		filepath.Join("/repo", "scripts", "bundle.py"), "build",
		filepath.Join("/repo", "assets", "gen", "scene.orb"), "/tmp/a.mp4",
		"--fps", "12", "--long-edge", "1280", "--codec", "jpeg", "--quality", "80", "--title", "生成视频",
		"--initial-angle", "15", "--orbit-span", "360", "--orbit-dir", "ccw", "--axis", "y",
		"--min-angle", "-170", "--max-angle", "170", "--catalog", filepath.Join("/repo", "catalog.json"),
	}, " ")
	if got != want {
		t.Fatalf("参数不对\n got: %s\nwant: %s", got, want)
	}
	if a.outPath() != filepath.Join("/repo", "assets", "gen", "scene.orb") {
		t.Fatalf("产物路径不对: %s", a.outPath())
	}
}

func TestBundleScriptReady(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "bundle.py")
	if err := os.WriteFile(path, []byte(`build --long-edge --codec --orbit-span --axis --min-angle --max-angle --catalog`), 0o644); err != nil {
		t.Fatal(err)
	}
	if !bundleScriptReady(path) {
		t.Fatal("带全部参数的脚本应该通过")
	}
	if err := os.WriteFile(path, []byte(`build --long-edge --codec`), 0o644); err != nil {
		t.Fatal(err)
	}
	if bundleScriptReady(path) {
		t.Fatal("缺参数的旧脚本应该被拦下")
	}
	if bundleScriptReady(filepath.Join(dir, "missing.py")) {
		t.Fatal("缺文件应该判为不可用")
	}
}

func TestParseProbe(t *testing.T) {
	data := []byte(`{"streams":[{"codec_name":"h264","width":752,"height":416,"r_frame_rate":"24/1"}],
		"format":{"duration":"10.041667"}}`)
	info, ok := parseProbe(data)
	if !ok {
		t.Fatal("解析失败")
	}
	if info.Width != 752 || info.Height != 416 || info.FPS != 24 || info.Codec != "h264" {
		t.Fatalf("解析结果不对: %+v", info)
	}
	if info.LongEdge() != 752 {
		t.Fatalf("long edge: %d", info.LongEdge())
	}
	if got := info.String(); got != "源：752×416 · 24 fps · 10.04 s · h264" {
		t.Fatalf("字符串: %q", got)
	}
	if _, ok := parseProbe([]byte("not json")); ok {
		t.Fatal("坏数据应该解析失败")
	}
}

func TestHelpers(t *testing.T) {
	if got := suggestID("/Users/x/My Video.mp4"); got != "my-video" {
		t.Fatalf("suggestID: %q", got)
	}
	if got := suggestID("视频.mp4"); got != "myid" {
		t.Fatalf("suggestID 中文: %q", got)
	}
	if got := trimNum(12); got != "12" {
		t.Fatalf("trimNum: %q", got)
	}
	if got := trimNum(6.5); got != "6.5" {
		t.Fatalf("trimNum: %q", got)
	}
	sep := string(os.PathListSeparator)
	if got := withPath([]string{"HOME=/x", "PATH=/a:/b"}, "/bin"); got[1] != "PATH=/bin"+sep+"/a:/b" {
		t.Fatalf("withPath: %v", got)
	}
}

// 预览页：没加载时是提示，加载仓库示例后能直接渲染出画面。
func TestPreviewViewRenders(t *testing.T) {
	a := &app{root: "../..", tab: 1}
	a.setStatus("预览", false)
	img := ui.Render(a.view, 900, 760, 1)
	if img == nil || img.Bounds().Dx() != 900 || img.Bounds().Dy() != 760 {
		t.Fatalf("渲染结果不对: %v", img)
	}
	if uniformImage(img) {
		t.Fatal("预览页是纯色的")
	}

	path := filepath.Join("..", "..", "assets", "orbit", "scene.orb")
	if _, err := os.Stat(path); err != nil {
		t.Skip("仓库示例不在")
	}
	client := orbit360.NewClient()
	if err := client.LoadFile(path); err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	a.preview, a.previewPath = client, path
	if img := ui.Render(a.view, 900, 760, 1); img == nil || uniformImage(img) {
		t.Fatal("加载 .orb 后预览页没有画面")
	}
}

func uniformImage(img *image.RGBA) bool {
	first := img.RGBAAt(0, 0)
	for y := 0; y < img.Bounds().Dy(); y += 7 {
		for x := 0; x < img.Bounds().Dx(); x += 7 {
			if img.RGBAAt(x, y) != first {
				return false
			}
		}
	}
	return true
}

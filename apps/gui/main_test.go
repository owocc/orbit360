package main

import (
	"strings"
	"testing"

	"github.com/egoist/mygo/ui"
)

// 视图能在没有窗口的情况下渲染出画面，且空日志、有日志、构建中三种状态都不出错。
func TestViewRenders(t *testing.T) {
	base := func() *app {
		return &app{
			root: "/tmp", python: "/usr/bin/python3", ffmpeg: "/opt/homebrew/bin/ffmpeg",
			video: "/tmp/a.mp4", id: "gen", title: "生成视频",
			fps: 12, std: 512, hd: 640, uhd: 752, jpegQ: 6,
			quality: 2, autoDir: 1, updateCatalog: true,
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
			a.setStatus("完成，点「打开预览」看看", false)
			a.appendLog("  std: 512x284 × 121 帧")
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
		fps: 12, std: 512, hd: 640, uhd: 0, jpegQ: 6,
		quality: 2, autoDir: 2, updateCatalog: true, keepRaw: true,
	}
	got := strings.Join(a.buildArgs("/repo/assets/gen"), " ")
	want := "/repo/scripts/build.py /tmp/a.mp4 --out /repo/assets/gen --title 生成视频" +
		" --fps 12 --std 512 --hd 640 --uhd 0 --quality 6" +
		" --default-quality uhd --default-auto ccw --keep-raw --catalog /repo/catalog.json"
	if got != want {
		t.Fatalf("参数不对\n got: %s\nwant: %s", got, want)
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
	if got := withPath([]string{"HOME=/x", "PATH=/a:/b"}, "/bin"); got[1] != "PATH=/bin:/a:/b" {
		t.Fatalf("withPath: %v", got)
	}
}

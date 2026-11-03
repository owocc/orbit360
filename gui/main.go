// Orbit360 打包工具：把 build.py 的「环绕视频 → 雪碧图 zip 资源包」流程
// 做成一个原生窗口（MyGo native UI，没有 webview）。
//
//	go run .        # 开发
//	go tool mygo build
package main

import (
	"bufio"
	"errors"
	"flag"
	"fmt"
	"image/png"
	"io"
	"log"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"

	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
)

var (
	qualityKeys   = []string{"std", "hd", "uhd"}
	qualityLabels = []string{"标准", "高清", "超清"}
	autoKeys      = []string{"off", "cw", "ccw"}
	autoLabels    = []string{"关", "顺时针", "逆时针"}
)

const logLimit = 400

// app 是窗口渲染的全部状态。
type app struct {
	// 环境
	root   string // 项目目录（build.py / assets / catalog.json 所在）
	python string
	ffmpeg string

	// 输入
	video   string
	id      string
	title   string
	srcInfo string

	// 参数
	fps, std, hd, uhd, jpegQ float64
	quality, autoDir         int
	keepRaw, updateCatalog   bool
	uhdTouched               bool // 用户改过超清长边后，不再随源视频自动调

	// 运行状态
	win       *mygo.Window
	busy      bool    // 构建或下载进行中
	progress  float64 // <0 表示长度未知
	cmd       *exec.Cmd
	status    string
	statusBad bool
	lastOut   string
	lastID    string

	logs      []string
	logScroll ui.ScrollState

	serveCmd *exec.Cmd
}

func main() {
	shot := flag.String("shot", "", "将界面渲染为 PNG 后退出（不开窗口，用来检查布局）")
	flag.Parse()
	if *shot != "" {
		a := newApp()
		a.id, a.title = "gen", "生成视频"
		a.uhd = 752
		if v := filepath.Join(a.root, "examples", "generated-video.mp4"); fileExists(v) {
			a.video = v
		}
		a.srcInfo = "源：752×416 · 24 fps · 10.04 s · h264"
		a.appendLog("源: generated-video.mp4  752x416  24fps  241帧  10.042s  h264")
		a.appendLog("闭环: 首尾相似度 1.0（相邻帧 0.994）")
		a.appendLog("  std: 512x284 × 121 帧  atlas     1.6 MB  packs/std.zip")
		a.setStatus("完成，点「打开预览」看看", false)
		a.lastOut, a.lastID = filepath.Join(a.root, "assets", "gen"), "gen"
		img := ui.Render(a.view, 900, 760, 2)
		f, err := os.Create(*shot)
		if err != nil {
			log.Fatal(err)
		}
		defer f.Close()
		if err := png.Encode(f, img); err != nil {
			log.Fatal(err)
		}
		fmt.Println("wrote", *shot)
		return
	}

	a := newApp()
	mygo.App.WhenReady(func() {
		a.win = mygo.NewWindow(mygo.WindowOptions{
			Title:     "Orbit360 打包工具",
			Width:     900,
			Height:    760,
			MinWidth:  720,
			MinHeight: 560,
			StateKey:  "main",
			Content:   ui.View(a.view),
		})
	})
	if err := mygo.App.Run(); err != nil {
		log.Fatal(err)
	}
	a.saveSettings()
}

/* ---------- 视图 ---------- */

func (a *app) view(c *ui.Context) {
	t := c.Theme()
	ui.Column(c).Fill().Padding(16).Gap(10).Children(func() {
		a.header(c, t)
		ui.Divider(c)
		ui.Form(c, func() {
			a.sources(c, t)
			a.params(c, t)
			ui.Divider(c)
			a.env(c, t)
		})
		a.actions(c, t)
		a.logView(c, t)
		a.footer(c, t)
	})
}

func (a *app) header(c *ui.Context, t *ui.Theme) {
	ui.Row(c).Gap(10).AlignItems(ui.Center).Children(func() {
		ui.Text(c, "Orbit360").FontSize(18).Bold()
		ui.Text(c, "视频 → 雪碧图 zip → 可转视角的 3D 画面").FontSize(12).TextColor(t.TextMuted)
		ui.Spacer(c).Grow(1)
		if a.busy {
			ui.Spinner(c)
		}
	})
}

func (a *app) sources(c *ui.Context, t *ui.Theme) {
	ui.Field(c, "源视频", func() {
		ui.Row(c).Gap(8).Children(func() {
			ui.TextInput(c, &a.video).Placeholder("选择一个环绕拍摄的视频（mp4 / mov / mkv …）").Grow(1)
			ui.Button(c, "选择…").OnClick(a.pickVideo)
		})
		if a.srcInfo != "" {
			ui.Text(c, a.srcInfo).FontSize(11).TextColor(t.TextMuted)
		}
	})
	ui.Row(c).Gap(12).AlignItems(ui.End).Children(func() {
		ui.Field(c, "示例 id", func() {
			ui.TextInput(c, &a.id).Placeholder("myid").Width(150)
		})
		ui.Field(c, "标题", func() {
			ui.TextInput(c, &a.title).Placeholder("我的示例").Grow(1)
		})
		ui.Textf(c, "→ assets/%s", orDash(a.id)).FontSize(12).TextColor(t.TextMuted).Padding(0, 0, 4, 0)
	})
	ui.Field(c, "项目目录", func() {
		ui.Row(c).Gap(8).Children(func() {
			ui.TextInput(c, &a.root).Placeholder("包含 build.py 的目录").Grow(1)
			ui.Button(c, "选择…").OnClick(a.pickRoot)
		})
	})
}

func (a *app) params(c *ui.Context, t *ui.Theme) {
	ui.Field(c, "尺寸与采样", func() {
		ui.Column(c).Gap(8).Children(func() {
			ui.Row(c).Gap(16).AlignItems(ui.Center).Children(func() {
				a.num(c, t, "帧率", &a.fps, 1, 60, 1)
				a.num(c, t, "标准长边", &a.std, 128, 4096, 16)
				a.num(c, t, "高清长边", &a.hd, 128, 4096, 16)
			})
			ui.Row(c).Gap(16).AlignItems(ui.Center).Children(func() {
				ui.Row(c).Gap(6).AlignItems(ui.Center).Children(func() {
					ui.Text(c, "超清长边").FontSize(12).TextColor(t.TextMuted)
					if ui.NumberInput(c, &a.uhd, 0, 4096, 16).Label("超清长边").Changed() {
						a.uhdTouched = true
					}
				})
				a.num(c, t, "JPEG 质量", &a.jpegQ, 2, 31, 1)
			})
		})
	})
	ui.Row(c).Gap(24).AlignItems(ui.End).Children(func() {
		ui.Field(c, "默认画质", func() {
			ui.Segmented(c, &a.quality, qualityLabels...).Label("默认画质")
		})
		ui.Field(c, "默认自动环绕", func() {
			ui.Segmented(c, &a.autoDir, autoLabels...).Label("默认自动环绕")
		})
		ui.Row(c).Gap(18).AlignItems(ui.Center).Padding(0, 0, 2, 0).Children(func() {
			ui.Row(c).Gap(6).AlignItems(ui.Center).Children(func() {
				ui.Switch(c, &a.keepRaw).Label("保留中间帧")
				ui.Text(c, "保留中间帧").FontSize(12)
			})
			ui.Row(c).Gap(6).AlignItems(ui.Center).Children(func() {
				ui.Switch(c, &a.updateCatalog).Label("更新 catalog.json")
				ui.Text(c, "更新 catalog.json").FontSize(12)
			})
		})
	})
	ui.Text(c, "标准 / 高清 / 超清是各档的长边像素（超清填 0 关掉该档），源视频比长边小时按源给，避免放大家庭。"+
		"帧率是标准档采样率，超清档帧数减半；每帧角度 = 360 / 帧数。").FontSize(11).TextColor(t.TextMuted)
}

func (a *app) num(c *ui.Context, t *ui.Theme, label string, v *float64, lo, hi, step float64) {
	ui.Row(c).Gap(6).AlignItems(ui.Center).Children(func() {
		ui.Text(c, label).FontSize(12).TextColor(t.TextMuted)
		ui.NumberInput(c, v, lo, hi, step).Label(label)
	})
}

func (a *app) env(c *ui.Context, t *ui.Theme) {
	ui.Field(c, "ffmpeg", func() {
		ui.Row(c).Gap(8).Children(func() {
			ui.TextInput(c, &a.ffmpeg).Placeholder("自动检测；也可指向任意 ffmpeg 可执行文件").Grow(1)
			ui.Button(c, "选择…").OnClick(a.pickFFmpeg)
			ui.Button(c, "检测").OnClick(a.detectEnv)
			ui.Button(c, "下载").Disabled(a.busy).OnClick(a.downloadFFmpeg)
		})
	})
	ui.Field(c, "python", func() {
		ui.Row(c).Gap(8).Children(func() {
			ui.TextInput(c, &a.python).Placeholder("python3").Grow(1)
			ui.Button(c, "选择…").OnClick(a.pickPython)
			ui.Button(c, "检测").OnClick(a.detectEnv)
		})
	})
	if hint := a.envHint(); hint != "" {
		ui.Text(c, hint).FontSize(11).TextColor(t.Warning)
	}
}

func (a *app) actions(c *ui.Context, t *ui.Theme) {
	ui.Row(c).Gap(8).AlignItems(ui.Center).Children(func() {
		if a.busy {
			ui.Button(c, "停止").OnClick(a.stop)
		} else {
			ui.PrimaryButton(c, "开始生成").Disabled(a.validate() != nil).OnClick(a.startBuild)
		}
		ui.Button(c, "打开预览").Disabled(a.lastOut == "").OnClick(a.openPreview)
		ui.Button(c, "打开输出目录").Disabled(a.lastOut == "").OnClick(func() {
			mygo.Shell.OpenPath(a.lastOut)
		})
		ui.Spacer(c).Grow(1)
		if a.status != "" {
			col := t.TextMuted
			switch {
			case a.statusBad:
				col = t.Danger
			case a.lastOut != "" && !a.busy:
				col = t.Success
			}
			ui.Text(c, a.status).FontSize(12).TextColor(col)
		}
	})
	if a.busy {
		ui.Progress(c, a.progress).Label("进度")
	}
}

func (a *app) logView(c *ui.Context, t *ui.Theme) {
	ui.Column(c).Grow(1).Border(1, t.Border).Radius(8).Padding(10).Children(func() {
		if len(a.logs) == 0 {
			ui.Text(c, "构建日志会显示在这里。\n选好源视频和示例 id，点「开始生成」。").FontSize(12).TextColor(t.TextMuted)
			return
		}
		// 跟随末尾，除非用户往上滚了
		if a.logScroll.Y >= a.logScroll.MaxY-1 {
			a.logScroll.Y = math.MaxFloat32
		}
		ui.Scroll(c).TrackScroll(&a.logScroll).Grow(1).Children(func() {
			ui.Column(c).Selectable().Gap(2).Children(func() {
				for _, line := range a.logs {
					col := t.Text
					if strings.HasPrefix(line, "错误") || strings.Contains(line, "⚠") {
						col = t.Warning
					}
					ui.Text(c, line).FontSize(12).TextColor(col).NoWrap()
				}
			})
		})
	})
}

func (a *app) footer(c *ui.Context, t *ui.Theme) {
	ui.Row(c).Gap(10).Children(func() {
		ui.Text(c, "生成后用「打开预览」启动本地服务并在浏览器里看；手机陀螺仪需要 HTTPS（python3 serve_tls.py 8443）。").
			FontSize(11).TextColor(t.TextMuted).Grow(1)
		if err := a.validate(); err != nil && !a.busy {
			ui.Text(c, err.Error()).FontSize(11).TextColor(t.TextMuted)
		}
	})
}

/* ---------- 校验 ---------- */

var idPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_-]*$`)

func (a *app) validate() error {
	if a.root == "" || !fileExists(filepath.Join(a.root, "build.py")) {
		return errors.New("找不到 build.py，检查项目目录")
	}
	if a.video == "" || !fileExists(a.video) {
		return errors.New("先选一个源视频")
	}
	if !idPattern.MatchString(a.id) {
		return errors.New("示例 id 只能含字母、数字、- _")
	}
	if a.title == "" {
		return errors.New("给示例填个标题")
	}
	if a.python == "" || !fileExists(a.python) {
		return errors.New("找不到 python")
	}
	if a.ffmpeg == "" || !fileExists(a.ffmpeg) {
		return errors.New("找不到 ffmpeg")
	}
	if !fileExists(ffprobeFor(a.ffmpeg)) {
		return errors.New("缺少 ffprobe（build.py 读源信息要用）")
	}
	return nil
}

func (a *app) envHint() string {
	switch {
	case a.python == "" || !fileExists(a.python):
		return "没找到 python3：装一个 Python 3，或手动指定解释器路径。"
	case a.ffmpeg == "" || !fileExists(a.ffmpeg):
		return "没找到 ffmpeg：点「下载」自动装一份，或用系统包管理器 / Homebrew 装好再点「检测」。"
	case !fileExists(ffprobeFor(a.ffmpeg)):
		return "缺少 ffprobe（要和 ffmpeg 放在同一目录）：点「下载」会把两个一起装好。"
	}
	return ""
}

/* ---------- 选择文件 ---------- */

func (a *app) pickVideo() {
	go func() {
		paths, err := mygo.Dialog.Open(mygo.OpenDialogOptions{
			Parent: a.win,
			Title:  "选择环绕视频",
			Filters: []mygo.FileFilter{{
				Name:       "视频",
				Extensions: []string{"mp4", "mov", "m4v", "webm", "mkv", "avi"},
			}},
		})
		if err != nil || len(paths) == 0 {
			return
		}
		path := paths[0]
		a.win.Update(func() {
			a.video = path
			a.uhdTouched = false
			if a.title == "" || a.title == "我的示例" {
				a.title = strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))
			}
			if a.id == "" {
				a.id = suggestID(path)
			}
		})
		a.probeAsync(path)
	}()
}

func (a *app) pickRoot() {
	go func() {
		paths, err := mygo.Dialog.Open(mygo.OpenDialogOptions{
			Parent:    a.win,
			Title:     "选择 orbit360 项目目录",
			Directory: true,
		})
		if err != nil || len(paths) == 0 {
			return
		}
		a.win.Update(func() {
			a.root = paths[0]
			a.detectEnvSync()
		})
	}()
}

func (a *app) pickFFmpeg() {
	go func() {
		paths, err := mygo.Dialog.Open(mygo.OpenDialogOptions{
			Parent:      a.win,
			Title:       "选择 ffmpeg 可执行文件",
			DefaultPath: filepath.Dir(a.ffmpeg),
		})
		if err != nil || len(paths) == 0 {
			return
		}
		a.win.Update(func() { a.ffmpeg = paths[0] })
	}()
}

func (a *app) pickPython() {
	go func() {
		paths, err := mygo.Dialog.Open(mygo.OpenDialogOptions{
			Parent: a.win,
			Title:  "选择 python3 可执行文件",
		})
		if err != nil || len(paths) == 0 {
			return
		}
		a.win.Update(func() { a.python = paths[0] })
	}()
}

func (a *app) detectEnv() {
	a.detectEnvSync()
}

func (a *app) detectEnvSync() {
	a.python = detectPython(a.root, a.python)
	if bin := detectFFmpeg(a.ffmpeg); bin != "" {
		a.ffmpeg = bin
	}
	switch {
	case a.python == "":
		a.setStatus("没找到 python3", true)
	case a.ffmpeg == "":
		a.setStatus("没找到 ffmpeg", true)
	default:
		a.setStatus("环境就绪："+filepath.Base(a.ffmpeg)+" / "+filepath.Base(a.python), false)
	}
}

/* ---------- 构建 ---------- */

// buildArgs 是 build.py 的命令行：视频 + 参数 + 输出目录（+ 清单）。
func (a *app) buildArgs(out string) []string {
	args := []string{
		filepath.Join(a.root, "build.py"),
		a.video,
		"--out", out,
		"--title", a.title,
		"--fps", trimNum(a.fps),
		"--std", trimNum(a.std),
		"--hd", trimNum(a.hd),
		"--uhd", trimNum(a.uhd),
		"--quality", trimNum(a.jpegQ),
		"--default-quality", qualityKeys[clampIndex(a.quality, len(qualityKeys))],
		"--default-auto", autoKeys[clampIndex(a.autoDir, len(autoKeys))],
	}
	if a.keepRaw {
		args = append(args, "--keep-raw")
	}
	if a.updateCatalog {
		args = append(args, "--catalog", filepath.Join(a.root, "catalog.json"))
	}
	return args
}

func (a *app) startBuild() {
	if err := a.validate(); err != nil {
		a.setStatus(err.Error(), true)
		return
	}
	a.saveSettings()

	out := filepath.Join(a.root, "assets", a.id)
	args := a.buildArgs(out)

	cmd := exec.Command(a.python, args...)
	cmd.Dir = a.root
	cmd.Env = withPath(os.Environ(), filepath.Dir(a.ffmpeg))

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		a.setStatus("启动失败："+err.Error(), true)
		return
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		a.setStatus("启动失败："+err.Error(), true)
		return
	}
	if err := cmd.Start(); err != nil {
		a.setStatus("启动失败："+err.Error(), true)
		return
	}

	a.busy = true
	a.progress = -1
	a.cmd = cmd
	a.lastOut = ""
	a.lastID = a.id
	a.logs = nil
	a.appendLog(fmt.Sprintf("$ %s %s", filepath.Base(a.python), strings.Join(args[1:], " ")))
	a.setStatus("正在生成…", false)

	lines := make(chan string, 512)
	var wg sync.WaitGroup
	scan := func(r io.Reader) {
		defer wg.Done()
		sc := bufio.NewScanner(r)
		sc.Buffer(make([]byte, 0, 64*1024), 1<<20)
		for sc.Scan() {
			lines <- sc.Text()
		}
	}
	wg.Add(2)
	go scan(stdout)
	go scan(stderr)
	go func() {
		wg.Wait()
		close(lines)
	}()

	win := a.win
	go func() {
		for line := range lines {
			line := line
			win.Update(func() { a.appendLog(line) })
		}
		err := cmd.Wait()
		win.Update(func() {
			a.busy = false
			a.progress = 0
			a.cmd = nil
			if err != nil {
				a.appendLog("错误：" + err.Error())
				a.setStatus("生成失败，看日志", true)
				return
			}
			a.lastOut = out
			a.appendLog("完成：" + out)
			a.setStatus("完成，点「打开预览」看看", false)
		})
	}()
}

func (a *app) stop() {
	if a.cmd == nil || a.cmd.Process == nil {
		return
	}
	if err := a.cmd.Process.Kill(); err != nil {
		a.setStatus("停止失败："+err.Error(), true)
		return
	}
	a.appendLog("已停止")
	a.busy = false
	a.progress = 0
	a.setStatus("已停止", true)
}

/* ---------- 预览 ---------- */

const previewPort = "8787"

func (a *app) openPreview() {
	if a.lastOut == "" {
		return
	}
	a.ensureServe()
	url := fmt.Sprintf("http://127.0.0.1:%s/?e=%s", previewPort, a.lastID)
	if err := mygo.Shell.OpenExternal(url); err != nil {
		a.setStatus("打不开浏览器："+err.Error(), true)
		return
	}
	a.setStatus("已打开 "+url, false)
}

func (a *app) ensureServe() {
	if portOpen(previewPort) || a.serveCmd != nil {
		return
	}
	cmd := exec.Command(a.python, filepath.Join(a.root, "serve.py"), previewPort)
	cmd.Dir = a.root
	if err := cmd.Start(); err != nil {
		a.appendLog("预览服务启动失败：" + err.Error())
		return
	}
	a.serveCmd = cmd
	a.appendLog("预览服务：http://127.0.0.1:" + previewPort + "/")
	go cmd.Wait()
}

/* ---------- 小工具 ---------- */

// onUI 在窗口的 UI 线程上改状态；没有窗口时（测试 / -shot）直接改。
func (a *app) onUI(fn func()) {
	if a.win != nil {
		a.win.Update(fn)
		return
	}
	fn()
}

func (a *app) appendLog(line string) {
	a.logs = append(a.logs, line)
	if len(a.logs) > logLimit {
		a.logs = append([]string(nil), a.logs[len(a.logs)-logLimit:]...)
	}
}

func (a *app) setStatus(s string, bad bool) {
	a.status = s
	a.statusBad = bad
}

func suggestID(path string) string {
	base := strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))
	base = strings.ToLower(base)
	var b strings.Builder
	for _, r := range base {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == '-' || r == '_':
			b.WriteRune(r)
		case r == ' ' || r == '.':
			b.WriteRune('-')
		}
	}
	id := strings.Trim(b.String(), "-_")
	if id == "" || !idPattern.MatchString(id) {
		return "myid"
	}
	if len(id) > 24 {
		id = id[:24]
	}
	return id
}

func clampIndex(i, n int) int {
	if i < 0 {
		return 0
	}
	if i >= n {
		return n - 1
	}
	return i
}

func trimNum(v float64) string {
	if v == math.Trunc(v) {
		return fmt.Sprintf("%d", int64(v))
	}
	return strings.TrimRight(fmt.Sprintf("%.3f", v), "0")
}

func orDash(s string) string {
	if s == "" {
		return "…"
	}
	return s
}

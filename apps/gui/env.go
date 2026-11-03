package main

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/egoist/mygo"
)

/* ---------- 启动与设置 ---------- */

type settings struct {
	Root          string  `json:"root"`
	Python        string  `json:"python"`
	FFmpeg        string  `json:"ffmpeg"`
	Video         string  `json:"video"`
	FPS           float64 `json:"fps"`
	LongEdge      float64 `json:"longEdge"`
	FrameQuality  float64 `json:"frameQuality"`
	Codec         int     `json:"codec"`
	OrbitSpan     float64 `json:"orbitSpan"`
	OrbitDir      int     `json:"orbitDir"`
	OrbitAxis     int     `json:"orbitAxis"`
	MinAngle      float64 `json:"minAngle"`
	MaxAngle      float64 `json:"maxAngle"`
	InitialAngle  float64 `json:"initialAngle"`
	UpdateCatalog bool    `json:"updateCatalog"`
}

func newApp() *app {
	a := &app{
		fps: 12, longEdge: defaultLongEdge, quality: 80,
		codec: 0, orbitSpan: 360, orbitDir: 0, orbitAxis: 0, initialAngle: 0,
		minAngle: -180, maxAngle: 180,
		updateCatalog: true,
	}
	a.loadSettings()
	if a.root == "" {
		a.root = findRoot()
	}
	a.detectEnvSync()
	if fileExists(a.video) {
		a.probeAsync(a.video)
	}
	return a
}

func configDir() string {
	base, err := os.UserConfigDir()
	if err != nil || base == "" {
		base = os.TempDir()
	}
	dir := filepath.Join(base, "orbit360-gui")
	os.MkdirAll(dir, 0o755)
	return dir
}

func settingsPath() string { return filepath.Join(configDir(), "settings.json") }

func (a *app) loadSettings() {
	data, err := os.ReadFile(settingsPath())
	if err != nil {
		return
	}
	var s settings
	if json.Unmarshal(data, &s) != nil {
		return
	}
	if s.Root != "" {
		a.root = s.Root
	}
	a.python, a.ffmpeg = s.Python, s.FFmpeg
	a.video = s.Video
	if s.FPS > 0 {
		a.fps = s.FPS
	}
	if s.LongEdge > 0 {
		a.longEdge = s.LongEdge
	}
	if s.FrameQuality > 0 {
		a.quality = s.FrameQuality
	}
	a.codec, a.orbitDir = s.Codec, s.OrbitDir
	a.orbitAxis = s.OrbitAxis
	if s.MinAngle < s.MaxAngle {
		a.minAngle, a.maxAngle = s.MinAngle, s.MaxAngle
	}
	if s.OrbitSpan > 0 {
		a.orbitSpan = s.OrbitSpan
	}
	a.initialAngle = s.InitialAngle
	a.updateCatalog = s.UpdateCatalog
}

func (a *app) saveSettings() {
	s := settings{
		Root: a.root, Python: a.python, FFmpeg: a.ffmpeg, Video: a.video,
		FPS: a.fps, LongEdge: a.longEdge, FrameQuality: a.quality,
		Codec: a.codec, OrbitSpan: a.orbitSpan, OrbitDir: a.orbitDir,
		OrbitAxis: a.orbitAxis,
		MinAngle:  a.minAngle, MaxAngle: a.maxAngle,
		InitialAngle: a.initialAngle, UpdateCatalog: a.updateCatalog,
	}
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return
	}
	os.WriteFile(settingsPath(), append(data, '\n'), 0o644)
}

// findRoot 从当前目录、可执行文件所在目录向上找带 scripts/bundle.py 的项目根目录。
func findRoot() string {
	dirs := []string{}
	if wd, err := os.Getwd(); err == nil {
		dirs = append(dirs, wd)
	}
	if exe, err := os.Executable(); err == nil {
		dirs = append(dirs, filepath.Dir(exe))
	}
	for _, d := range dirs {
		for i := 0; i < 4 && d != "" && d != string(filepath.Separator); i++ {
			if fileExists(filepath.Join(d, "scripts", "bundle.py")) {
				return d
			}
			d = filepath.Dir(d)
		}
	}
	if len(dirs) > 0 {
		return dirs[0]
	}
	return "."
}

/* ---------- 检测 ---------- */

func detectPython(root, current string) string {
	if fileExists(current) {
		return current
	}
	for _, name := range []string{"python3", "python"} {
		if p, err := exec.LookPath(name); err == nil {
			return p
		}
	}
	for _, p := range []string{
		"/opt/homebrew/bin/python3",
		"/usr/local/bin/python3",
		"/usr/bin/python3",
		filepath.Join(root, ".venv", "bin", "python"),
	} {
		if fileExists(p) {
			return p
		}
	}
	return ""
}

func detectFFmpeg(current string) string {
	if fileExists(current) {
		return current
	}
	name := "ffmpeg"
	if runtime.GOOS == "windows" {
		name = "ffmpeg.exe"
	}
	if p, err := exec.LookPath(name); err == nil {
		return p
	}
	candidates := []string{
		filepath.Join(configDir(), "bin", name),
		"/opt/homebrew/bin/" + name,
		"/usr/local/bin/" + name,
		"/usr/bin/" + name,
		"/snap/bin/" + name,
	}
	for _, p := range candidates {
		if fileExists(p) {
			return p
		}
	}
	return ""
}

// ffprobeFor 从 ffmpeg 的路径推出同目录的 ffprobe（scripts/bundle.py 两个都要）。
func ffprobeFor(ffmpeg string) string {
	name := "ffprobe"
	if runtime.GOOS == "windows" {
		name = "ffprobe.exe"
	}
	return filepath.Join(filepath.Dir(ffmpeg), name)
}

/* ---------- 下载 ffmpeg ---------- */

func (a *app) downloadFFmpeg() {
	if a.busy {
		return
	}
	if runtime.GOOS == "linux" {
		a.setStatus("Linux 用包管理器装：sudo apt install ffmpeg，然后点「检测」", true)
		mygo.Shell.OpenExternal("https://ffmpeg.org/download.html")
		return
	}
	a.busy = true
	a.progress = 0
	a.setStatus("正在下载 ffmpeg…", false)
	a.appendLog("开始下载 ffmpeg（" + runtime.GOOS + "/" + runtime.GOARCH + "）")
	win := a.win

	go func() {
		bin, err := fetchFFmpeg(func(fraction float64, note string) {
			win.Update(func() {
				a.progress = fraction
				if note != "" {
					a.appendLog(note)
				}
			})
		})
		win.Update(func() {
			a.busy = false
			a.progress = 0
			if err != nil {
				a.appendLog("错误：" + err.Error())
				a.setStatus("下载失败："+err.Error(), true)
				return
			}
			a.ffmpeg = bin
			a.python = detectPython(a.root, a.python)
			a.appendLog("ffmpeg 已就绪：" + bin)
			a.setStatus("ffmpeg 已就绪", false)
			a.saveSettings()
		})
	}()
}

// fetchFFmpeg 下载并解出 ffmpeg + ffprobe 到配置目录，返回 ffmpeg 路径。
func fetchFFmpeg(progress func(fraction float64, note string)) (string, error) {
	binDir := filepath.Join(configDir(), "bin")
	if err := os.MkdirAll(binDir, 0o755); err != nil {
		return "", err
	}
	tmp, err := os.MkdirTemp("", "orbit360-ffmpeg-")
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(tmp)

	switch runtime.GOOS {
	case "darwin":
		for _, tool := range []string{"ffmpeg", "ffprobe"} {
			url, err := evermeetZipURL(tool)
			if err != nil {
				return "", err
			}
			progress(-1, "下载 "+url)
			zipPath := filepath.Join(tmp, tool+".zip")
			if err := download(url, zipPath, func(f float64) { progress(f, "") }); err != nil {
				return "", err
			}
			if err := extractZip(zipPath, func(name string) (string, bool) {
				if filepath.Base(name) != tool {
					return "", false
				}
				return filepath.Join(binDir, tool), true
			}); err != nil {
				return "", err
			}
		}
	case "windows":
		url := "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
		progress(-1, "下载 "+url)
		zipPath := filepath.Join(tmp, "ffmpeg.zip")
		if err := download(url, zipPath, func(f float64) { progress(f, "") }); err != nil {
			return "", err
		}
		if err := extractZip(zipPath, func(name string) (string, bool) {
			base := strings.ToLower(filepath.Base(name))
			if base != "ffmpeg.exe" && base != "ffprobe.exe" {
				return "", false
			}
			return filepath.Join(binDir, base), true
		}); err != nil {
			return "", err
		}
	default:
		return "", fmt.Errorf("这个平台请用包管理器安装 ffmpeg（%s）", runtime.GOOS)
	}

	name := "ffmpeg"
	if runtime.GOOS == "windows" {
		name = "ffmpeg.exe"
	}
	bin := filepath.Join(binDir, name)
	if !fileExists(bin) {
		bin = detectFFmpeg("")
	}
	if bin == "" {
		return "", fmt.Errorf("解压后没找到 ffmpeg")
	}
	if !fileExists(ffprobeFor(bin)) {
		return "", fmt.Errorf("缺少 ffprobe，请手动装一份完整的 ffmpeg")
	}
	return bin, nil
}

// evermeetZipURL 取 evermeet.cx 上 macOS 静态构建的最新 zip 地址。
func evermeetZipURL(tool string) (string, error) {
	resp, err := http.Get("https://evermeet.cx/ffmpeg/info/" + tool + "/release")
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("%s 信息查询失败：HTTP %d", tool, resp.StatusCode)
	}
	var info struct {
		Download struct {
			Zip struct {
				URL string `json:"url"`
			} `json:"zip"`
		} `json:"download"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return "", err
	}
	if info.Download.Zip.URL == "" {
		return "", fmt.Errorf("%s 没有可下载的 zip", tool)
	}
	return info.Download.Zip.URL, nil
}

func download(url, dest string, progress func(float64)) error {
	client := &http.Client{Timeout: 30 * time.Minute}
	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("下载失败：HTTP %d", resp.StatusCode)
	}
	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer out.Close()
	total := resp.ContentLength
	buf := make([]byte, 256*1024)
	var done int64
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			if _, werr := out.Write(buf[:n]); werr != nil {
				return werr
			}
			done += int64(n)
			if total > 0 && progress != nil {
				progress(float64(done) / float64(total))
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
	}
	return out.Close()
}

// extractZip 把匹配到的条目解到 target 路径。
func extractZip(zipPath string, match func(name string) (target string, ok bool)) error {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer r.Close()
	found := false
	for _, f := range r.File {
		target, ok := match(f.Name)
		if !ok {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return err
		}
		func() {
			defer rc.Close()
			if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
				return
			}
			out, err := os.OpenFile(target, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o755)
			if err != nil {
				return
			}
			defer out.Close()
			if _, err := io.Copy(out, rc); err != nil {
				return
			}
		}()
		os.Chmod(target, 0o755)
		found = true
	}
	if !found {
		return fmt.Errorf("压缩包里没找到需要的文件")
	}
	return nil
}

/* ---------- 源视频信息 ---------- */

type probeInfo struct {
	Width, Height int
	FPS           float64
	Duration      float64
	Codec         string
}

func (p probeInfo) LongEdge() int {
	if p.Width > p.Height {
		return p.Width
	}
	return p.Height
}

func (p probeInfo) String() string {
	s := fmt.Sprintf("源：%d×%d · %g fps · %.2f s", p.Width, p.Height, p.FPS, p.Duration)
	if p.Codec != "" {
		s += " · " + p.Codec
	}
	return s
}

func parseProbe(data []byte) (probeInfo, bool) {
	var doc struct {
		Streams []struct {
			Width      int    `json:"width"`
			Height     int    `json:"height"`
			RFrameRate string `json:"r_frame_rate"`
			CodecName  string `json:"codec_name"`
		} `json:"streams"`
		Format struct {
			Duration string `json:"duration"`
		} `json:"format"`
	}
	if err := json.Unmarshal(data, &doc); err != nil || len(doc.Streams) == 0 {
		return probeInfo{}, false
	}
	v := doc.Streams[0]
	p := probeInfo{Width: v.Width, Height: v.Height, Codec: v.CodecName}
	if num, den, ok := strings.Cut(v.RFrameRate, "/"); ok {
		fps, err1 := strconv.ParseFloat(num, 64)
		d, err2 := strconv.ParseFloat(den, 64)
		if err1 == nil && err2 == nil && d > 0 {
			p.FPS = math.Round(fps/d*100) / 100
		}
	} else if fps, err := strconv.ParseFloat(v.RFrameRate, 64); err == nil {
		p.FPS = fps
	}
	p.Duration, _ = strconv.ParseFloat(doc.Format.Duration, 64)
	return p, p.Width > 0 && p.Height > 0
}

// probeAsync 用 ffprobe 读源视频尺寸，并把每帧长边收窄到源的长边（除非用户自己改过）。
func (a *app) probeAsync(path string) {
	ffprobe := ffprobeFor(a.ffmpeg)
	if !fileExists(ffprobe) {
		if p, err := exec.LookPath("ffprobe"); err == nil {
			ffprobe = p
		}
	}
	if ffprobe == "" || path == "" {
		return
	}
	go func() {
		out, err := exec.Command(ffprobe, "-v", "error", "-select_streams", "v:0",
			"-show_entries", "stream=width,height,r_frame_rate,codec_name:format=duration",
			"-of", "json", path).Output()
		if err != nil {
			return
		}
		info, ok := parseProbe(out)
		if !ok {
			return
		}
		a.onUI(func() {
			a.srcInfo = info.String()
			if !a.longEdgeTouched && info.LongEdge() > 0 {
				edge := info.LongEdge()
				if edge > defaultLongEdge {
					edge = defaultLongEdge
				}
				if edge%2 != 0 && edge > 2 {
					edge--
				}
				a.longEdge = float64(edge)
			}
		})
	}()
}

/* ---------- 杂项 ---------- */

func fileExists(path string) bool {
	if path == "" {
		return false
	}
	st, err := os.Stat(path)
	return err == nil && !st.IsDir()
}

func portOpen(port string) bool {
	conn, err := net.DialTimeout("tcp", "127.0.0.1:"+port, 250*time.Millisecond)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

// withPath 把 ffmpeg 所在目录放到 PATH 前面，scripts/bundle.py 调 ffmpeg/ffprobe 就能找到。
func withPath(env []string, dir string) []string {
	if dir == "" {
		return env
	}
	key := "PATH="
	sep := string(os.PathListSeparator)
	out := make([]string, 0, len(env)+1)
	found := false
	for _, kv := range env {
		if strings.HasPrefix(kv, key) {
			out = append(out, key+dir+sep+strings.TrimPrefix(kv, key))
			found = true
			continue
		}
		out = append(out, kv)
	}
	if !found {
		out = append(out, key+dir)
	}
	return out
}

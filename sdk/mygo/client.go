// Package orbit360 用 MyGo 原生控件渲染 ORB3/v1 场景包。
//
// 解析、引擎与布局全部来自 github.com/owocc/orbit360/sdk/go：本包只负责
// 把 RenderSnapshot + RenderPlan 画进 MyGo 窗口，并把指针输入转成引擎事件。
// 它不启动浏览器、不依赖 WebView，帧由 Go 解码成 ui.Bitmap。
package orbit360

import (
	"fmt"
	"math"
	"os"
	"sync"
	"time"

	"github.com/egoist/mygo/ui"
	core "github.com/owocc/orbit360/sdk/go"
)

// 自动环绕方向，与 OrbitEngine 的 auto.dir 一致。
const (
	AutoOff = "off"
	AutoCW  = "cw"
	AutoCCW = "ccw"
)

// 画面适应方式，与 OrbitEngine 的 video.fit 一致。
const (
	FitContain = "contain"
	FitCover   = "cover"
)

// DefaultCacheSize 是帧位图缓存的默认数量。
const DefaultCacheSize = 24

// Options 是 Client 的可选参数。零值表示沿用场景包自己的配置。
type Options struct {
	// Fit 是初始适应方式：FitContain / FitCover。
	Fit string
	// Auto 是初始自动环绕方向：AutoOff / AutoCW / AutoCCW。
	Auto string
	// CacheSize 是帧位图缓存数量，默认 24。
	CacheSize int
	// Config 是传给 OrbitEngine 的用户配置，结构与 spec/orbit-config 一致。
	Config map[string]any
}

type cacheKey struct {
	video int
	frame int
}

type renderLayer struct {
	slot int
	bm   *ui.Bitmap
}

// Client 是 MyGo 桌面环境下的 ORB3 渲染与交互状态。
// 它不持有窗口：在视图里调用 View(c)，状态由窗口的 UI 线程驱动。
type Client struct {
	mu sync.Mutex

	bundle *core.Bundle
	engine *core.Engine

	// userConfig 保存调用方覆盖的配置，重新加载场景包时继续生效。
	userConfig map[string]any

	cache     map[cacheKey]*ui.Bitmap
	order     []cacheKey
	cacheSize int

	err string

	// 指针输入要换算成引擎需要的绝对坐标与时间。
	start              time.Time
	last               time.Time
	nowMs              float64
	pressing           bool
	pointerX, pointerY float64
}

// NewClient 创建渲染客户端。之后用 Load / LoadFile / SetBundle 载入场景包。
func NewClient(opts ...Options) *Client {
	o := Options{}
	if len(opts) > 0 {
		o = opts[0]
	}
	if o.CacheSize <= 0 {
		o.CacheSize = DefaultCacheSize
	}
	return &Client{
		userConfig: o.userConfig(),
		cache:      make(map[cacheKey]*ui.Bitmap),
		cacheSize:  o.CacheSize,
	}
}

func (o Options) userConfig() map[string]any {
	config := cloneConfig(o.Config)
	if o.Fit != "" {
		config = mergeConfig(config, map[string]any{
			"video": map[string]any{"fit": normalizeFit(o.Fit)},
		})
	}
	if o.Auto != "" {
		mode := normalizeAuto(o.Auto)
		config = mergeConfig(config, map[string]any{
			"auto": map[string]any{
				"enabled": mode != AutoOff,
				"dir":     autoDir(mode),
			},
		})
	}
	return config
}

// LoadFile 打开一个 .orb 并替换当前场景。
func (c *Client) LoadFile(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return c.Load(data)
}

// Load 解析内存里的 .orb 并替换当前场景。解析错误是 *core.OrbError。
func (c *Client) Load(data []byte) error {
	bundle, err := core.Parse(data)
	if err != nil {
		return err
	}
	c.SetBundle(bundle)
	return nil
}

// SetBundle 替换当前场景。bundle 由调用方持有，Client 只读。
func (c *Client) SetBundle(bundle *core.Bundle) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.engine != nil {
		c.engine.Destroy()
	}
	c.bundle = bundle
	c.engine = nil
	c.cache = make(map[cacheKey]*ui.Bitmap)
	c.order = nil
	c.err = ""
	c.pressing = false
	c.pointerX, c.pointerY = 0, 0
	c.start = time.Time{}
	c.last = time.Time{}
	c.nowMs = 0
	if bundle == nil {
		return
	}
	c.engine = core.NewEngine(engineBundle(bundle), c.userConfig)
}

// Bundle 返回当前场景包，可能为 nil。
func (c *Client) Bundle() *core.Bundle {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.bundle
}

// Meta 返回当前场景元数据。
func (c *Client) Meta() (core.Meta, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.bundle == nil {
		return core.Meta{}, false
	}
	return c.bundle.Meta, true
}

// Snapshot 返回引擎的当前渲染快照。
func (c *Client) Snapshot() core.Snapshot {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.snapshotLocked()
}

// Close 释放场景包、引擎与帧缓存。
func (c *Client) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.engine != nil {
		c.engine.Destroy()
	}
	c.engine = nil
	c.bundle = nil
	c.cache = make(map[cacheKey]*ui.Bitmap)
	c.order = nil
	c.err = ""
	c.pressing = false
	c.start = time.Time{}
}

// SetConfig 覆盖引擎配置，字段见 spec/orbit-config。
func (c *Client) SetConfig(partial map[string]any) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.userConfig = mergeConfig(c.userConfig, partial)
	if c.engine != nil {
		c.engine.SetConfig(partial)
	}
}

// ResetConfig 清空调用方覆盖，回到场景包自己的配置。
func (c *Client) ResetConfig() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.userConfig = map[string]any{}
	if c.engine != nil {
		c.engine.ResetConfig()
	}
}

// SetAuto 设置自动环绕方向：AutoOff / AutoCW / AutoCCW。
func (c *Client) SetAuto(mode string) {
	mode = normalizeAuto(mode)
	c.SetConfig(map[string]any{
		"auto": map[string]any{"enabled": mode != AutoOff, "dir": autoDir(mode)},
	})
}

// Auto 返回自动环绕方向；关闭时是 AutoOff。
func (c *Client) Auto() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.engine == nil {
		return AutoOff
	}
	config := c.engine.GetConfig()
	if !config.Auto.Enabled {
		return AutoOff
	}
	return config.Auto.Dir
}

// SetFit 设置画面适应方式：FitContain / FitCover。
func (c *Client) SetFit(fit string) {
	c.SetConfig(map[string]any{
		"video": map[string]any{"fit": normalizeFit(fit)},
	})
}

// Fit 返回当前适应方式。
func (c *Client) Fit() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.engine == nil {
		return FitContain
	}
	return c.engine.GetConfig().Video.Fit
}

// SetAngle 设置目标角度。immediate 为 true 时直接跳到该角度。
func (c *Client) SetAngle(deg float64, immediate bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.engine != nil {
		c.engine.SetAngle(deg, immediate)
	}
}

// RotateBy 在目标角度上增加 deg 度。
func (c *Client) RotateBy(deg float64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.engine != nil {
		c.engine.RotateBy(deg)
	}
}

// Reset 回到场景包的初始角度。
func (c *Client) Reset() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.engine == nil {
		return
	}
	angle := 0.0
	if c.bundle != nil {
		angle = c.bundle.Meta.InitialAngle
	}
	c.engine.Reset(angle, true)
}

// ResetTo 回到指定角度。
func (c *Client) ResetTo(deg float64, immediate bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.engine != nil {
		c.engine.Reset(deg, immediate)
	}
}

// Angle 返回当前显示角度。
func (c *Client) Angle() float64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.engine == nil {
		return 0
	}
	return c.engine.GetAngle()
}

// FrameIndex 返回当前主视频帧号。
func (c *Client) FrameIndex() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.engine == nil {
		return 0
	}
	return c.engine.GetFrameIndex()
}

// Pause 暂停引擎推进，画面保持当前帧。
func (c *Client) Pause() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.engine != nil {
		c.engine.Pause()
	}
}

// Resume 恢复引擎推进。
func (c *Client) Resume() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.engine != nil {
		c.engine.Resume()
	}
}

// EnableGyro 打开陀螺仪；具体采样由宿主用 Gyro 传入。
func (c *Client) EnableGyro() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.engine != nil {
		c.engine.EnableGyro()
	}
}

// DisableGyro 关闭陀螺仪。
func (c *Client) DisableGyro() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.engine != nil {
		c.engine.DisableGyro()
	}
}

// CalibrateGyro 把当前朝向记为陀螺仪零点。
func (c *Client) CalibrateGyro() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.engine != nil {
		c.engine.CalibrateGyro()
	}
}

// Gyro 传入一次航向角采样（度），时间用客户端内部时钟。
func (c *Client) Gyro(heading float64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.engine != nil {
		c.engine.Gyro(heading, c.nowMs)
	}
}

// Error 返回最近一次解码错误。
func (c *Client) Error() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.err
}

// SetCacheSize 调整帧位图缓存数量，立即淘汰多余的项。
func (c *Client) SetCacheSize(size int) {
	if size <= 0 {
		size = DefaultCacheSize
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cacheSize = size
	c.trimCacheLocked()
}

// View 构建可放进任意布局的渲染元素：拖拽转动、自动环绕、按 fit 缩放。
func (c *Client) View(ctx *ui.Context) ui.Element {
	box := ui.Box(ctx).Grow(1)

	c.mu.Lock()
	bundle := c.bundle
	engine := c.engine
	if bundle == nil || engine == nil {
		message := "没有加载场景包"
		if c.err != "" {
			message = c.err
		}
		c.mu.Unlock()
		return box.Draw(func(p *ui.Painter, r ui.Rect) {
			p.Fill(r, ui.RGBA(0, 0, 0, 1), 0)
			p.Text(r.X+16, r.Y+16, message, 13, ui.RGBA(230, 230, 230, 1))
		})
	}

	dt := c.tickLocked(ctx.Now())
	c.pointerLocked(box, engine)
	engine.Advance(dt)

	snapshot := engine.GetSnapshot()
	config := engine.GetConfig()
	if c.pressing || (!snapshot.Paused && (snapshot.Auto.Enabled || snapshot.Auto.Weight > 0 ||
		math.Abs(snapshot.TargetAngle-snapshot.Angle) > 0.0005 ||
		math.Abs(snapshot.Velocity) > 0.0005)) {
		ctx.AnimationFrame()
	}

	layers := make([]renderLayer, 0, len(snapshot.Layers))
	for _, layer := range snapshot.Layers {
		bitmap, err := c.bitmapLocked(layer.LayerIndex, layer.FrameIndex)
		if err != nil {
			c.err = err.Error()
			continue
		}
		layers = append(layers, renderLayer{slot: layer.LayerIndex, bm: bitmap})
	}
	if len(layers) == len(snapshot.Layers) {
		c.err = ""
	}
	errText := c.err
	canvas := bundle.Meta.Canvas
	fit := config.Video.Fit
	displayScale := config.Video.DisplayScale
	portraitScale := config.Video.PortraitScale
	layoutInput := layoutLayers(bundle)
	c.mu.Unlock()

	return box.Draw(func(p *ui.Painter, r ui.Rect) {
		p.Fill(r, ui.RGBA(0, 0, 0, 1), 0)
		if len(layers) == 0 {
			message := "解码帧失败"
			if errText != "" {
				message = errText
			}
			p.Text(r.X+16, r.Y+16, message, 13, ui.RGBA(230, 230, 230, 1))
			return
		}
		plan := core.ComputeLayout(core.LayoutInput{
			Canvas:        canvas,
			Viewport:      core.Canvas{Width: int(math.Round(float64(r.W))), Height: int(math.Round(float64(r.H)))},
			Fit:           fit,
			DisplayScale:  &displayScale,
			PortraitScale: &portraitScale,
			Layers:        layoutInput,
		})
		destination := ui.Rect{
			X: r.X + float32(plan.DestinationRect.X),
			Y: r.Y + float32(plan.DestinationRect.Y),
			W: float32(plan.DestinationRect.Width),
			H: float32(plan.DestinationRect.Height),
		}
		p.Clip(destination, 0, func() {
			for _, layer := range layers {
				if layer.bm == nil || layer.slot < 0 || layer.slot >= len(plan.Layers) {
					continue
				}
				rect := plan.Layers[layer.slot].Rect
				p.Image(layer.bm, ui.Rect{
					X: r.X + float32(rect.X),
					Y: r.Y + float32(rect.Y),
					W: float32(rect.Width),
					H: float32(rect.Height),
				}, ui.FillBox)
			}
		})
	})
}

// tickLocked 推进内部时钟，返回这一帧的毫秒数（上限 64ms，与引擎一致）。
func (c *Client) tickLocked(now time.Time) float64 {
	if c.start.IsZero() {
		c.start = now
		c.last = now
		return 0
	}
	dt := now.Sub(c.last).Seconds() * 1000
	if dt < 0 {
		dt = 0
	}
	if dt > 64 {
		dt = 64
	}
	c.last = now
	c.nowMs += dt
	return dt
}

// pointerLocked 把 MyGo 的拖拽增量换算成引擎的指针事件。
func (c *Client) pointerLocked(box ui.Element, engine *core.Engine) {
	dx, dy, pressed := box.Dragged()
	if pressed && !c.pressing {
		c.pressing = true
		c.pointerX, c.pointerY = 0, 0
		engine.PointerDown(0, 0, c.nowMs)
	}
	if pressed && c.pressing && (dx != 0 || dy != 0) {
		c.pointerX += float64(dx)
		c.pointerY += float64(dy)
		engine.PointerMove(c.pointerX, c.pointerY, c.nowMs)
	}
	if !pressed && c.pressing {
		c.pressing = false
		engine.PointerUp(c.nowMs)
	}
}

func (c *Client) snapshotLocked() core.Snapshot {
	if c.engine == nil {
		return core.Snapshot{}
	}
	return c.engine.GetSnapshot()
}

// bitmapLocked 读取并解码一帧，缓存最近使用的若干帧。
func (c *Client) bitmapLocked(videoIndex, frameIndex int) (*ui.Bitmap, error) {
	key := cacheKey{video: videoIndex, frame: frameIndex}
	if bitmap, ok := c.cache[key]; ok {
		c.touchLocked(key)
		return bitmap, nil
	}
	data, err := c.bundle.FrameBytes(videoIndex, frameIndex)
	if err != nil {
		return nil, err
	}
	bitmap, err := ui.DecodeBitmap(data)
	if err != nil {
		return nil, fmt.Errorf("解码第 %d 帧失败（%s）：%w；桌面版支持 webp / jpeg / png，avif 请改用 --codec webp",
			frameIndex, c.bundle.Meta.Codec, err)
	}
	c.cache[key] = bitmap
	c.order = append(c.order, key)
	c.trimCacheLocked()
	return bitmap, nil
}

func (c *Client) touchLocked(key cacheKey) {
	for index, item := range c.order {
		if item == key {
			c.order = append(append(c.order[:index], c.order[index+1:]...), key)
			return
		}
	}
	c.order = append(c.order, key)
}

func (c *Client) trimCacheLocked() {
	for len(c.order) > c.cacheSize {
		old := c.order[0]
		c.order = c.order[1:]
		delete(c.cache, old)
	}
}

func engineBundle(bundle *core.Bundle) core.EngineBundle {
	videos := make([]core.EngineLayerInput, len(bundle.Layers))
	for index, layer := range bundle.Layers {
		videos[index] = core.EngineLayerInput{Rect: layer.Rect, FrameCount: layer.FrameCount}
	}
	return core.EngineBundle{
		Canvas:       bundle.Meta.Canvas,
		InitialAngle: bundle.Meta.InitialAngle,
		Videos:       videos,
		SceneConfig:  bundle.SceneConfig,
	}
}

func layoutLayers(bundle *core.Bundle) []core.LayoutLayerInput {
	layers := make([]core.LayoutLayerInput, len(bundle.Layers))
	for index, layer := range bundle.Layers {
		layers[index] = core.LayoutLayerInput{LayerIndex: index, Rect: layer.Rect}
	}
	return layers
}

func normalizeFit(fit string) string {
	if fit == FitCover {
		return FitCover
	}
	return FitContain
}

func normalizeAuto(mode string) string {
	switch mode {
	case AutoCW, AutoCCW:
		return mode
	default:
		return AutoOff
	}
}

func autoDir(mode string) string {
	if mode == AutoCCW {
		return AutoCCW
	}
	return AutoCW
}

func cloneConfig(source map[string]any) map[string]any {
	result := make(map[string]any, len(source))
	for key, value := range source {
		if nested, ok := value.(map[string]any); ok {
			result[key] = cloneConfig(nested)
			continue
		}
		result[key] = value
	}
	return result
}

func mergeConfig(base, patch map[string]any) map[string]any {
	result := cloneConfig(base)
	for key, value := range patch {
		nested, nestedOK := value.(map[string]any)
		current, currentOK := result[key].(map[string]any)
		if nestedOK && currentOK {
			result[key] = mergeConfig(current, nested)
			continue
		}
		if nestedOK {
			result[key] = cloneConfig(nested)
			continue
		}
		result[key] = value
	}
	return result
}

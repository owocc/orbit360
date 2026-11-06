package orbit360

import (
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/egoist/mygo/ui"
)

// AutoMode 是自动环绕的状态。
type AutoMode int

const (
	AutoOff AutoMode = iota
	AutoCW
	AutoCCW
)

// Fit 是画面适应方式。
type Fit int

const (
	FitContain Fit = iota
	FitCover
)

// Options 是 Client 的可选参数。
type Options struct {
	// Auto 是默认自动环绕状态。
	Auto AutoMode
	// Speed 是自动环绕速度（度/秒），默认 14。
	Speed float64
	// DegPerPx 是拖拽灵敏度（度/像素），默认 0.42。
	DegPerPx float64
	// Fit 是默认适应方式，默认 FitContain。
	Fit Fit
	// Invert 翻转拖拽方向。
	Invert bool
	// CacheSize 是帧位图缓存数量，默认 24。
	CacheSize int
}

type cacheKey struct {
	video int
	frame int
}

type cacheItem struct {
	key cacheKey
	bm  *ui.Bitmap
}

// Client 是 MyGo 桌面环境下的 ORB3 渲染与交互状态。
// 它不持有窗口：在视图里调用 View(c) 即可，状态由窗口的 UI 线程驱动。
type Client struct {
	mu  sync.Mutex
	b   *Bundle
	opt Options

	target float64
	angle  float64
	auto   AutoMode

	cache     map[cacheKey]*ui.Bitmap
	order     []cacheItem
	cacheSize int

	lastTime time.Time
	err      string
}

// NewClient 创建渲染客户端。b 可以为 nil，之后再 SetBundle / LoadFile。
func NewClient(b *Bundle, opts ...Options) *Client {
	o := Options{Auto: AutoOff, Speed: 14, DegPerPx: 0.42, Fit: FitContain, CacheSize: 24}
	if len(opts) > 0 {
		o = opts[0]
	}
	if o.Speed <= 0 {
		o.Speed = 14
	}
	if o.DegPerPx <= 0 {
		o.DegPerPx = 0.42
	}
	if o.CacheSize <= 0 {
		o.CacheSize = 24
	}
	c := &Client{
		b:         b,
		opt:       o,
		auto:      o.Auto,
		cache:     make(map[cacheKey]*ui.Bitmap),
		cacheSize: o.CacheSize,
	}
	if b != nil {
		c.target = c.norm(b.Meta.InitialAngle)
		c.angle = c.target
	}
	return c
}

// LoadFile 打开一个 .orb 并替换当前场景。
func (c *Client) LoadFile(path string) error {
	b, err := Open(path)
	if err != nil {
		return err
	}
	c.SetBundle(b)
	return nil
}

// SetBundle 替换当前场景，并接管 b 的关闭责任。
func (c *Client) SetBundle(b *Bundle) {
	c.mu.Lock()
	old := c.b
	c.b = b
	c.angle = 0
	if b != nil {
		c.target = c.norm(b.Meta.InitialAngle)
		c.angle = c.target
	}
	c.err = ""
	c.cache = make(map[cacheKey]*ui.Bitmap)
	c.order = nil
	c.mu.Unlock()
	if old != nil {
		old.Close()
	}
}

// Bundle 返回当前场景包，可能为 nil。
func (c *Client) Bundle() *Bundle {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.b
}

// Meta 返回当前场景元数据。
func (c *Client) Meta() (Meta, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.b == nil {
		return Meta{}, false
	}
	return c.b.Meta, true
}

// Close 关闭场景包并释放帧缓存。
func (c *Client) Close() {
	c.mu.Lock()
	b := c.b
	c.b = nil
	c.cache = make(map[cacheKey]*ui.Bitmap)
	c.order = nil
	c.mu.Unlock()
	if b != nil {
		b.Close()
	}
}

// SetAuto 设置自动环绕状态。
func (c *Client) SetAuto(mode AutoMode) {
	c.mu.Lock()
	c.auto = mode
	c.mu.Unlock()
}

// Auto 返回自动环绕状态。
func (c *Client) Auto() AutoMode {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.auto
}

// SetFit 设置适应方式。
func (c *Client) SetFit(f Fit) {
	c.mu.Lock()
	c.opt.Fit = f
	c.mu.Unlock()
}

// Fit 返回适应方式。
func (c *Client) Fit() Fit {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.opt.Fit
}

// SetSpeed 设置自动环绕速度（度/秒）。
func (c *Client) SetSpeed(degPerSec float64) {
	c.mu.Lock()
	c.opt.Speed = degPerSec
	c.mu.Unlock()
}

// SetInvert 翻转拖拽方向。
func (c *Client) SetInvert(invert bool) {
	c.mu.Lock()
	c.opt.Invert = invert
	c.mu.Unlock()
}

// SetAngle 设置目标角度，会被钳制在场景允许的范围内。
func (c *Client) SetAngle(deg float64) {
	c.mu.Lock()
	c.target = c.norm(deg)
	c.mu.Unlock()
}

// RotateBy 在当前目标角度上增加 deg 度。
func (c *Client) RotateBy(deg float64) {
	c.mu.Lock()
	c.target = c.norm(c.target + deg)
	c.mu.Unlock()
}

// Reset 回到场景的初始角度。
func (c *Client) Reset() {
	c.mu.Lock()
	init := 0.0
	if c.b != nil {
		init = c.b.Meta.InitialAngle
	}
	c.target = c.norm(init)
	c.mu.Unlock()
}

// Angle 返回当前显示角度。
func (c *Client) Angle() float64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.angle
}

// FrameIndex 返回当前主视频帧号。
func (c *Client) FrameIndex() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.frameIndexLocked()
}

// Error 返回最近一次解码/加载错误。
func (c *Client) Error() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.err
}

// View 构建可放进任意布局的渲染元素：拖拽转动、自动环绕、按 fit 缩放。
func (c *Client) View(ctx *ui.Context) ui.Element {
	c.mu.Lock()
	b := c.b
	if b == nil {
		c.mu.Unlock()
		return ui.Box(ctx).Grow(1).Draw(func(p *ui.Painter, r ui.Rect) {
			p.Fill(r, ui.RGBA(0, 0, 0, 1), 0)
			msg := "没有加载场景包"
			if c.err != "" {
				msg = c.err
			}
			p.Text(r.X+16, r.Y+16, msg, 13, ui.RGBA(230, 230, 230, 1))
		})
	}
	now := ctx.Now()
	dt := 0.0
	if !c.lastTime.IsZero() {
		dt = math.Min(now.Sub(c.lastTime).Seconds(), 0.064)
	}
	c.lastTime = now

	box := ui.Box(ctx).Grow(1)
	dx, dy, pressed := box.Dragged()
	if pressed {
		px := dx
		if b.resolved.Axis == AxisY {
			px = dy
		}
		sign := 1.0
		if c.opt.Invert {
			sign = -1
		}
		c.target = c.norm(c.target + float64(px)*c.opt.DegPerPx*sign)
	}
	// 自动环绕只在没有按住时走；拖拽后从当前目标继续。
	if c.auto != AutoOff && !pressed {
		dir := 1.0
		if c.auto == AutoCCW {
			dir = -1
		}
		c.target = c.norm(c.target + dir*c.opt.Speed*dt)
		ctx.AnimationFrame()
	}
	// 角度阻尼，跟网页客户端的 motion.smoothMs 一致。
	delta := c.angleDelta(c.angle, c.target)
	tau := 0.045
	if dt > 0 {
		c.angle = c.norm(c.angle + delta*(1-math.Exp(-dt/tau)))
	} else {
		c.angle = c.norm(c.angle + delta)
	}
	if math.Abs(c.angleDelta(c.angle, c.target)) < 0.0005 {
		c.angle = c.target
	}
	if c.auto != AutoOff || delta != 0 {
		ctx.AnimationFrame()
	}

	index := c.frameIndexLocked()
	type layer struct {
		bm   *ui.Bitmap
		rect Rect
	}
	layers := make([]layer, 0, len(b.Meta.Videos))
	decodeErr := false
	for vi := range b.Meta.Videos {
		v := &b.Meta.Videos[vi]
		fi := layerFrame(v, index, b.Count())
		bm, err := c.bitmap(vi, fi)
		if err != nil {
			c.err = err.Error()
			decodeErr = true
			continue
		}
		layers = append(layers, layer{bm: bm, rect: v.Rect})
	}
	if !decodeErr {
		c.err = ""
	}
	canvas := b.Meta.Canvas
	fit := c.opt.Fit
	c.mu.Unlock()

	box.Draw(func(p *ui.Painter, r ui.Rect) {
		p.Fill(r, ui.RGBA(0, 0, 0, 1), 0)
		if len(layers) == 0 {
			msg := "解码帧失败"
			if c.Error() != "" {
				msg = c.Error()
			}
			p.Text(r.X+16, r.Y+16, msg, 13, ui.RGBA(230, 230, 230, 1))
			return
		}
		cw, ch := float32(canvas.Width), float32(canvas.Height)
		scale := min(r.W/cw, r.H/ch)
		if fit == FitCover {
			scale = max(r.W/cw, r.H/ch)
		}
		dst := ui.Rect{
			X: r.X + (r.W-cw*scale)/2,
			Y: r.Y + (r.H-ch*scale)/2,
			W: cw * scale,
			H: ch * scale,
		}
		p.Clip(dst, 0, func() {
			for _, l := range layers {
				if l.bm == nil {
					continue
				}
				lr := ui.Rect{
					X: dst.X + float32(l.rect.X)/cw*dst.W,
					Y: dst.Y + float32(l.rect.Y)/ch*dst.H,
					W: float32(l.rect.Width) / cw * dst.W,
					H: float32(l.rect.Height) / ch * dst.H,
				}
				p.Image(l.bm, lr, ui.FillBox)
			}
		})
	})
	return box
}

func (c *Client) frameIndexLocked() int {
	if c.b == nil {
		return 0
	}
	count := c.b.Count()
	if count == 0 {
		return 0
	}
	dirSign := 1.0
	if c.b.resolved.Direction == CounterClockwise {
		dirSign = -1
	}
	angle := wrapSigned(c.angle * dirSign)
	span := c.b.resolved.SpanDeg
	if span >= 360 {
		degPerFrame := span / float64(count)
		idx := int(math.Round(mod(mod(angle, 360)/degPerFrame, float64(count))))
		return ((idx % count) + count) % count
	}
	t := (angle + span/2) / span
	idx := int(math.Round(t * float64(count-1)))
	return min(count-1, max(0, idx))
}

func layerFrame(v *Video, index, mainCount int) int {
	if v.Frames.Count == 0 {
		return 0
	}
	if v.Frames.Count == mainCount || mainCount == 0 {
		return min(v.Frames.Count-1, max(0, index))
	}
	i := int(math.Floor(float64(index) * float64(v.Frames.Count) / float64(mainCount)))
	return ((i % v.Frames.Count) + v.Frames.Count) % v.Frames.Count
}

// bitmap 读取并解码一帧，缓存最近使用的若干帧。必须在 UI 线程调用。
func (c *Client) bitmap(videoIndex, frameIndex int) (*ui.Bitmap, error) {
	key := cacheKey{video: videoIndex, frame: frameIndex}
	if bm := c.cache[key]; bm != nil {
		return bm, nil
	}
	data, err := c.b.Frame(videoIndex, frameIndex)
	if err != nil {
		return nil, err
	}
	bm, err := ui.DecodeBitmap(data)
	if err != nil {
		return nil, fmt.Errorf("解码第 %d 帧失败（%s）：%w；桌面版支持 webp / jpeg / png，avif 请改用 --codec webp", frameIndex, c.b.Meta.Codec, err)
	}
	c.cache[key] = bm
	c.order = append(c.order, cacheItem{key: key, bm: bm})
	for len(c.order) > c.cacheSize {
		old := c.order[0]
		c.order = c.order[1:]
		if c.cache[old.key] == old.bm {
			delete(c.cache, old.key)
		}
	}
	return bm, nil
}

func (c *Client) norm(v float64) float64 {
	if c.b == nil {
		return v
	}
	o := c.b.resolved
	if o.MinAngle > -180 || o.MaxAngle < 180 {
		return clamp(v, o.MinAngle, o.MaxAngle)
	}
	return wrapSigned(v)
}

func (c *Client) angleDelta(from, to float64) float64 {
	if c.b != nil {
		o := c.b.resolved
		if o.MinAngle > -180 || o.MaxAngle < 180 {
			return to - from
		}
	}
	return shortDelta(from, to)
}

func mod(a, n float64) float64 {
	return math.Mod(math.Mod(a, n)+n, n)
}

func wrapSigned(deg float64) float64 {
	return mod(deg+180, 360) - 180
}

func shortDelta(from, to float64) float64 {
	return mod(to-from+180, 360) - 180
}

func clamp(v, lo, hi float64) float64 {
	return min(hi, max(lo, v))
}

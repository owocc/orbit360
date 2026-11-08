package orbit360

import "math"

type EngineLayerInput struct {
	Rect       Rect `json:"rect"`
	FrameCount int  `json:"frameCount"`
}

type EngineBundle struct {
	Canvas       Canvas             `json:"canvas"`
	InitialAngle float64            `json:"initialAngle"`
	Videos       []EngineLayerInput `json:"videos"`
	SceneConfig  map[string]any     `json:"sceneConfig"`
}

type LayerSnapshot struct {
	LayerIndex int  `json:"layerIndex"`
	FrameIndex int  `json:"frameIndex"`
	FrameCount int  `json:"frameCount"`
	Rect       Rect `json:"rect"`
}

type AutoSnapshot struct {
	State       string  `json:"state"`
	Enabled     bool    `json:"enabled"`
	Direction   string  `json:"direction"`
	Speed       float64 `json:"speed"`
	Weight      float64 `json:"weight"`
	IdleDelayMs float64 `json:"idleDelayMs"`
	RampInMs    float64 `json:"rampInMs"`
	RampOutMs   float64 `json:"rampOutMs"`
}

type GyroSnapshot struct {
	Enabled  bool    `json:"enabled"`
	Seen     bool    `json:"seen"`
	Gain     float64 `json:"gain"`
	Invert   bool    `json:"invert"`
	Smooth   bool    `json:"smooth"`
	SmoothMs float64 `json:"smoothMs"`
}

type Snapshot struct {
	Ready       bool            `json:"ready"`
	Loading     bool            `json:"loading"`
	Paused      bool            `json:"paused"`
	Destroyed   bool            `json:"destroyed"`
	Angle       float64         `json:"angle"`
	TargetAngle float64         `json:"targetAngle"`
	Velocity    float64         `json:"velocity"`
	Axis        string          `json:"axis"`
	Direction   string          `json:"direction"`
	SpanDeg     float64         `json:"spanDeg"`
	MinAngle    float64         `json:"minAngle"`
	MaxAngle    float64         `json:"maxAngle"`
	Limited     bool            `json:"limited"`
	FrameIndex  int             `json:"frameIndex"`
	FrameCount  int             `json:"frameCount"`
	FrameDeg    float64         `json:"frameDeg"`
	Dragging    bool            `json:"dragging"`
	Auto        AutoSnapshot    `json:"auto"`
	Gyro        GyroSnapshot    `json:"gyro"`
	Layers      []LayerSnapshot `json:"layers"`
}

type Engine struct {
	bundle      EngineBundle
	sceneConfig map[string]any
	userConfig  map[string]any
	config      Config
	ready       bool
	paused      bool
	destroyed   bool
	angle       float64
	target      float64
	velocity    float64
	dragging    bool
	limited     bool
	axis        string
	minAngle    float64
	maxAngle    float64
	frameCount  int
	degPerFrame float64
	layers      []EngineLayerInput
	lastX       float64
	lastY       float64
	lastPtrTime float64
	now         float64
	lastActive  float64
	autoState   string
	autoDir     float64
	autoSpeed   float64
	autoWeight  float64
	gyroActive  bool
	gyroSeen    bool
	gyroRef     float64
	hasGyroRef  bool
	gyroBase    float64
	lastGyro    float64
}

func NewEngine(bundle EngineBundle, userConfig map[string]any) *Engine {
	if userConfig == nil {
		userConfig = map[string]any{}
	}
	engine := &Engine{
		sceneConfig: cloneMap(bundle.SceneConfig),
		userConfig:  cloneMap(userConfig),
		config:      resolveConfigMapToConfig(resolveConfigMap(bundle.SceneConfig, userConfig)),
	}
	engine.loadInternal(bundle)
	return engine
}

func mod(a, n float64) float64 {
	return math.Mod(math.Mod(a, n)+n, n)
}

func shortDelta(from, to float64) float64 {
	return mod(to-from+180, 360) - 180
}

func wrapSigned(deg float64) float64 {
	return mod(deg+180, 360) - 180
}

func clamp(value, low, high float64) float64 {
	return math.Min(high, math.Max(low, value))
}

func roundHalfUp(value float64) float64 {
	return math.Floor(value + 0.5)
}

func (e *Engine) loadInternal(bundle EngineBundle) {
	e.bundle = bundle
	e.sceneConfig = cloneMap(bundle.SceneConfig)
	e.layers = append([]EngineLayerInput(nil), bundle.Videos...)
	e.frameCount = 0
	for _, layer := range bundle.Videos {
		if layer.FrameCount > e.frameCount {
			e.frameCount = layer.FrameCount
		}
	}
	e.config = resolveConfigMapToConfig(resolveConfigMap(e.sceneConfig, e.userConfig))
	e.applyConfig()
	e.angle = e.normalize(bundle.InitialAngle)
	e.target = e.angle
	e.velocity = 0
	e.dragging = false
	e.autoWeight = 0
	e.hasGyroRef = false
	e.gyroBase = 0
	e.lastActive = e.now
	e.ready = true
	e.paused = false
	e.recalcFrames()
}

func (e *Engine) Load(bundle EngineBundle) {
	if e.destroyed {
		return
	}
	e.loadInternal(bundle)
}

func (e *Engine) SetConfig(partial map[string]any) {
	if e.destroyed {
		return
	}
	e.lastActive = e.now
	e.userConfig = deepMerge(e.userConfig, partial)
	e.config = resolveConfigMapToConfig(resolveConfigMap(e.sceneConfig, e.userConfig))
	e.applyConfig()
}

func (e *Engine) ResetConfig() {
	if e.destroyed {
		return
	}
	e.userConfig = map[string]any{}
	e.config = resolveConfigMapToConfig(resolveConfigMap(e.sceneConfig, e.userConfig))
	e.applyConfig()
	e.lastActive = e.now
}

func (e *Engine) SetAngle(deg float64, immediate bool) {
	if e.destroyed {
		return
	}
	e.target = e.normalize(deg)
	e.velocity = 0
	if immediate {
		e.angle = e.target
	}
	e.lastActive = e.now
}

func (e *Engine) RotateBy(deg float64) {
	if e.destroyed {
		return
	}
	e.target = e.normalize(e.target + deg)
	e.lastActive = e.now
}

func (e *Engine) PointerDown(x, y, timeMs float64) {
	if e.destroyed {
		return
	}
	e.eventTime(timeMs)
	e.dragging = true
	e.velocity = 0
	e.lastX = x
	e.lastY = y
	e.lastPtrTime = timeMs
	e.lastActive = e.now
}

func (e *Engine) PointerMove(x, y, timeMs float64) {
	if e.destroyed || !e.dragging {
		return
	}
	e.eventTime(timeMs)
	dx := x - e.lastX
	dy := y - e.lastY
	dt := math.Max(timeMs-e.lastPtrTime, 1)
	px := dx
	if e.axis == "y" {
		px = dy
	}
	deg := px * e.config.Drag.DegPerPx
	if e.config.Drag.Invert {
		deg = -deg
	}
	e.target = e.normalize(e.target + deg)
	inst := 0.0
	if dt <= 90 {
		inst = deg / dt
	}
	e.velocity = 0.6*inst + 0.4*e.velocity
	e.lastX = x
	e.lastY = y
	e.lastPtrTime = timeMs
	e.lastActive = e.now
}

func (e *Engine) PointerUp(timeMs float64) {
	if e.destroyed || !e.dragging {
		return
	}
	e.eventTime(timeMs)
	e.dragging = false
	if timeMs-e.lastPtrTime > 90 {
		e.velocity = 0
	}
	e.velocity = clamp(e.velocity, -0.55, 0.55)
	e.lastActive = e.now
}

func (e *Engine) EnableGyro() {
	if !e.destroyed {
		e.gyroActive = true
	}
}

func (e *Engine) Gyro(heading, timeMs float64) {
	if e.destroyed {
		return
	}
	e.eventTime(timeMs)
	e.gyroActive = true
	e.gyroSeen = true
	if e.dragging {
		return
	}
	if !e.hasGyroRef {
		e.gyroRef = heading
		e.gyroBase = e.target
		e.hasGyroRef = true
		e.lastGyro = e.now
		e.lastActive = e.now
		return
	}
	gain := e.config.Gyro.Gain
	if e.config.Gyro.Invert {
		gain = -gain
	}
	if e.config.Drag.Invert {
		gain = -gain
	}
	delta := shortDelta(e.gyroRef, heading) * gain
	raw := e.normalize(e.gyroBase - delta)
	if e.config.Gyro.Smooth {
		dt := clamp(e.now-e.lastGyro, 1, 120)
		e.lastGyro = e.now
		e.target = e.normalize(e.target + e.angleDelta(e.target, raw)*(1-math.Exp(-dt/e.config.Gyro.SmoothMs)))
	} else {
		e.target = raw
	}
	e.lastActive = e.now
}

func (e *Engine) DisableGyro() {
	if e.destroyed {
		return
	}
	e.gyroActive = false
	e.hasGyroRef = false
	e.gyroBase = 0
}

func (e *Engine) CalibrateGyro() {
	if e.destroyed {
		return
	}
	e.hasGyroRef = false
	e.gyroBase = e.target
}

func (e *Engine) Pause() {
	if !e.destroyed {
		e.paused = true
	}
}

func (e *Engine) Resume() {
	if !e.destroyed {
		e.paused = false
	}
}

func (e *Engine) Reset(angle float64, immediate bool) {
	if e.destroyed {
		return
	}
	e.target = e.normalize(angle)
	e.velocity = 0
	e.hasGyroRef = false
	e.gyroBase = 0
	if immediate {
		e.angle = e.target
	}
	e.lastActive = e.now
}

func (e *Engine) Unload() {
	if e.destroyed {
		return
	}
	e.bundle = EngineBundle{}
	e.sceneConfig = map[string]any{}
	e.layers = nil
	e.frameCount = 0
	e.angle = 0
	e.target = 0
	e.velocity = 0
	e.dragging = false
	e.autoWeight = 0
	e.hasGyroRef = false
	e.gyroBase = 0
	e.ready = false
	e.paused = false
	e.config = resolveConfigMapToConfig(resolveConfigMap(map[string]any{}, e.userConfig))
	e.applyConfig()
	e.lastActive = e.now
}

func (e *Engine) Destroy() {
	e.destroyed = true
	e.dragging = false
	e.velocity = 0
}

func (e *Engine) Advance(dtMs float64) {
	if e.destroyed || e.paused {
		return
	}
	dt := clamp(dtMs, 0, 64)
	if math.IsNaN(dt) {
		dt = 0
	}
	e.now += dt

	if !e.dragging {
		if e.config.Drag.Inertia && !e.gyroActive && math.Abs(e.velocity) > 0.0005 {
			next := e.normalize(e.target + e.velocity*dt)
			if e.limited && next == e.target {
				e.velocity = 0
			}
			e.target = next
			e.velocity *= math.Exp(-dt / e.config.Drag.InertiaMs)
			e.lastActive = e.now
		} else {
			e.velocity = 0
		}
	}

	idle := e.now - e.lastActive
	want := 0.0
	if e.autoState != "off" && !e.gyroActive && !e.dragging && idle > e.config.Auto.IdleDelayMs {
		want = 1
	}
	tau := e.config.Auto.RampOutMs
	if want > 0 {
		tau = e.config.Auto.RampInMs
	} else if e.dragging {
		tau = 120
	}
	e.autoWeight += (want - e.autoWeight) * (1 - math.Exp(-dt/tau))
	if want == 0 && e.autoWeight < 0.004 {
		e.autoWeight = 0
	}
	if e.autoWeight > 0 {
		e.target = e.normalize(e.target + e.autoDir*e.autoSpeed*e.autoWeight*dt/1000)
	}

	delta := e.angleDelta(e.angle, e.target)
	next := e.angle + delta*(1-math.Exp(-dt/e.config.Motion.SmoothMs))
	if e.limited {
		e.angle = clamp(next, e.minAngle, e.maxAngle)
	} else {
		e.angle = mod(next, 360)
	}
	if math.Abs(e.angleDelta(e.angle, e.target)) < 0.0005 {
		e.angle = e.target
	}
}

func (e *Engine) GetAngle() float64 {
	return e.normalize(e.angle)
}

func (e *Engine) GetTargetAngle() float64 {
	return e.normalize(e.target)
}

func (e *Engine) GetFrameIndex() int {
	return e.frameIndex()
}

func (e *Engine) GetFrameCount() int {
	return e.frameCount
}

func (e *Engine) GetConfig() Config {
	return e.config
}

func (e *Engine) GetSnapshot() Snapshot {
	frameIndex := e.frameIndex()
	autoDirection := e.autoState
	if autoDirection == "off" {
		autoDirection = e.config.Auto.Dir
	}
	layers := make([]LayerSnapshot, 0, len(e.layers))
	for index, layer := range e.layers {
		layerFrame := frameIndex
		if layer.FrameCount != e.frameCount {
			layerFrame = int(mod(float64(frameIndex*layer.FrameCount/e.maxInt(1, e.frameCount)), float64(layer.FrameCount)))
		}
		layers = append(layers, LayerSnapshot{
			LayerIndex: index,
			FrameIndex: layerFrame,
			FrameCount: layer.FrameCount,
			Rect:       layer.Rect,
		})
	}
	return Snapshot{
		Ready:       e.ready,
		Loading:     false,
		Paused:      e.paused,
		Destroyed:   e.destroyed,
		Angle:       e.normalize(e.angle),
		TargetAngle: e.normalize(e.target),
		Velocity:    e.velocity,
		Axis:        e.axis,
		Direction:   e.config.Orbit.Direction,
		SpanDeg:     e.frameSpan(),
		MinAngle:    e.minAngle,
		MaxAngle:    e.maxAngle,
		Limited:     e.limited,
		FrameIndex:  frameIndex,
		FrameCount:  e.frameCount,
		FrameDeg:    e.degPerFrame,
		Dragging:    e.dragging,
		Auto: AutoSnapshot{
			State:       e.autoState,
			Enabled:     e.autoState != "off",
			Direction:   autoDirection,
			Speed:       e.autoSpeed,
			Weight:      e.autoWeight,
			IdleDelayMs: e.config.Auto.IdleDelayMs,
			RampInMs:    e.config.Auto.RampInMs,
			RampOutMs:   e.config.Auto.RampOutMs,
		},
		Gyro: GyroSnapshot{
			Enabled:  e.gyroActive,
			Seen:     e.gyroSeen,
			Gain:     e.config.Gyro.Gain,
			Invert:   e.config.Gyro.Invert,
			Smooth:   e.config.Gyro.Smooth,
			SmoothMs: e.config.Gyro.SmoothMs,
		},
		Layers: layers,
	}
}

func (e *Engine) eventTime(timeMs float64) float64 {
	if timeMs > e.now {
		e.now = timeMs
	}
	return timeMs
}

func (e *Engine) frameSpan() float64 {
	return math.Min(360, e.config.Orbit.SpanDeg)
}

func (e *Engine) recalcFrames() {
	divisor := e.frameCount
	if divisor < 1 {
		divisor = 1
	}
	e.degPerFrame = e.frameSpan() / float64(divisor)
}

func (e *Engine) applyConfig() {
	e.axis = e.config.Orbit.Axis
	e.minAngle = e.config.Orbit.MinAngle
	e.maxAngle = e.config.Orbit.MaxAngle
	e.limited = e.minAngle > -180 || e.maxAngle < 180
	if e.limited {
		e.target = clamp(e.target, e.minAngle, e.maxAngle)
		e.angle = clamp(e.angle, e.minAngle, e.maxAngle)
	}
	if e.config.Auto.Enabled {
		e.autoState = e.config.Auto.Dir
	} else {
		e.autoState = "off"
	}
	e.autoDir = 1
	if e.autoState == "ccw" {
		e.autoDir = -1
	}
	e.autoSpeed = e.config.Auto.DegPerSec
	e.recalcFrames()
}

func (e *Engine) normalize(value float64) float64 {
	if math.IsNaN(value) || math.IsInf(value, 0) {
		if e.limited {
			return e.minAngle
		}
		return 0
	}
	if e.limited {
		return clamp(value, e.minAngle, e.maxAngle)
	}
	return wrapSigned(value)
}

func (e *Engine) angleDelta(from, to float64) float64 {
	if e.limited {
		return to - from
	}
	return shortDelta(from, to)
}

func (e *Engine) frameIndex() int {
	if e.frameCount == 0 {
		return 0
	}
	dirSign := 1.0
	if e.config.Orbit.Direction == "ccw" {
		dirSign = -1
	}
	angle := wrapSigned(e.angle * dirSign)
	span := e.frameSpan()
	if span >= 360 {
		value := roundHalfUp(mod(angle, 360) / e.degPerFrame)
		return int(mod(value, float64(e.frameCount)))
	}
	t := (angle + span/2) / span
	value := roundHalfUp(t * float64(e.frameCount-1))
	if value < 0 {
		value = 0
	}
	if value > float64(e.frameCount-1) {
		value = float64(e.frameCount - 1)
	}
	return int(value)
}

func (e *Engine) maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

package orbit360

import "math"

type VideoConfig struct {
	DisplayScale  float64
	PortraitScale float64
	Fit           string
	Width         float64
	Height        float64
}

type OrbitConfig struct {
	Axis      string
	SpanDeg   float64
	Direction string
	MinAngle  float64
	MaxAngle  float64
}

type DragConfig struct {
	DegPerPx  float64
	Invert    bool
	Inertia   bool
	InertiaMs float64
}

type MotionConfig struct {
	SmoothMs float64
}

type AutoConfig struct {
	Enabled     bool
	Dir         string
	DegPerSec   float64
	IdleDelayMs float64
	RampInMs    float64
	RampOutMs   float64
}

type GyroConfig struct {
	Gain     float64
	Invert   bool
	Smooth   bool
	SmoothMs float64
}

type MouseFollowConfig struct {
	Enabled  bool
	DegPerPx float64
}

type Config struct {
	Title       string
	Video       VideoConfig
	Orbit       OrbitConfig
	Drag        DragConfig
	Motion      MotionConfig
	Auto        AutoConfig
	Gyro        GyroConfig
	MouseFollow MouseFollowConfig
}

func defaultConfigMap() map[string]any {
	return map[string]any{
		"title": "",
		"video": map[string]any{
			"displayScale": 1.0, "portraitScale": 1.25, "fit": "contain", "width": 1280.0, "height": 720.0,
		},
		"orbit": map[string]any{
			"axis": "x", "spanDeg": 360.0, "direction": "cw", "minAngle": -180.0, "maxAngle": 180.0,
		},
		"drag": map[string]any{
			"degPerPx": 0.42, "invert": false, "inertia": true, "inertiaMs": 110.0,
		},
		"motion": map[string]any{"smoothMs": 62.0},
		"auto": map[string]any{
			"enabled": false, "dir": "cw", "degPerSec": 36.0, "idleDelayMs": 2200.0,
			"rampInMs": 700.0, "rampOutMs": 280.0,
		},
		"gyro": map[string]any{
			"gain": 1.0, "invert": false, "smooth": true, "smoothMs": 80.0,
		},
		"mouseFollow": map[string]any{"enabled": false, "degPerPx": 0.3},
	}
}

func cloneMap(source map[string]any) map[string]any {
	result := map[string]any{}
	for key, value := range source {
		if nested, ok := asMap(value); ok {
			result[key] = cloneMap(nested)
		} else {
			result[key] = value
		}
	}
	return result
}

func deepMerge(base, source map[string]any) map[string]any {
	result := map[string]any{}
	for key, value := range base {
		if nested, ok := asMap(value); ok {
			result[key] = cloneMap(nested)
		} else {
			result[key] = value
		}
	}
	for key, value := range source {
		current, currentIsMap := asMap(result[key])
		next, nextIsMap := asMap(value)
		if nextIsMap && currentIsMap {
			result[key] = deepMerge(current, next)
		} else if nextIsMap {
			result[key] = cloneMap(next)
		} else {
			result[key] = value
		}
	}
	return result
}

func numberOr(m map[string]any, key string, fallback float64) float64 {
	if value, ok := asFloat(m[key]); ok {
		return value
	}
	return fallback
}

func boolOr(m map[string]any, key string, fallback bool) bool {
	if value, ok := m[key].(bool); ok {
		return value
	}
	return fallback
}

func stringOrDefault(m map[string]any, key, fallback string) string {
	if value, ok := asString(m[key]); ok {
		return value
	}
	return fallback
}

func resolveConfigMap(sceneConfig, userConfig map[string]any) map[string]any {
	scene := deepMerge(map[string]any{}, sceneConfig)
	if defaults, ok := asMap(scene["defaults"]); ok {
		if auto, ok := asMap(defaults["auto"]); ok {
			existing, _ := asMap(scene["auto"])
			if existing == nil {
				existing = map[string]any{}
			}
			scene["auto"] = deepMerge(existing, auto)
		}
	}
	return deepMerge(deepMerge(defaultConfigMap(), scene), userConfig)
}

func resolveConfigMapToConfig(values map[string]any) Config {
	video, _ := asMap(values["video"])
	orbit, _ := asMap(values["orbit"])
	drag, _ := asMap(values["drag"])
	motion, _ := asMap(values["motion"])
	auto, _ := asMap(values["auto"])
	gyro, _ := asMap(values["gyro"])
	mouse, _ := asMap(values["mouseFollow"])

	minAngle := math.Min(180, math.Max(-180, numberOr(orbit, "minAngle", -180)))
	maxAngle := math.Min(180, math.Max(-180, numberOr(orbit, "maxAngle", 180)))
	if minAngle > maxAngle {
		minAngle, maxAngle = maxAngle, minAngle
	}
	span := numberOr(orbit, "spanDeg", 360)
	if span <= 0 {
		span = 360
	}
	span = math.Min(360, span)
	return Config{
		Title: stringOrDefault(values, "title", ""),
		Video: VideoConfig{
			DisplayScale:  numberOr(video, "displayScale", 1),
			PortraitScale: numberOr(video, "portraitScale", 1.25),
			Fit:           fitOr(video),
			Width:         numberOr(video, "width", 1280),
			Height:        numberOr(video, "height", 720),
		},
		Orbit: OrbitConfig{
			Axis:      axisOr(orbit),
			SpanDeg:   span,
			Direction: directionOr(orbit),
			MinAngle:  minAngle,
			MaxAngle:  maxAngle,
		},
		Drag: DragConfig{
			DegPerPx:  numberOr(drag, "degPerPx", 0.42),
			Invert:    boolOr(drag, "invert", false),
			Inertia:   boolOr(drag, "inertia", true),
			InertiaMs: numberOr(drag, "inertiaMs", 110),
		},
		Motion: MotionConfig{SmoothMs: numberOr(motion, "smoothMs", 62)},
		Auto: AutoConfig{
			Enabled:     boolOr(auto, "enabled", false),
			Dir:         directionOr(auto),
			DegPerSec:   numberOr(auto, "degPerSec", 36),
			IdleDelayMs: numberOr(auto, "idleDelayMs", 2200),
			RampInMs:    numberOr(auto, "rampInMs", 700),
			RampOutMs:   numberOr(auto, "rampOutMs", 280),
		},
		Gyro: GyroConfig{
			Gain:     numberOr(gyro, "gain", 1),
			Invert:   boolOr(gyro, "invert", false),
			Smooth:   boolOr(gyro, "smooth", true),
			SmoothMs: numberOr(gyro, "smoothMs", 80),
		},
		MouseFollow: MouseFollowConfig{
			Enabled:  boolOr(mouse, "enabled", false),
			DegPerPx: numberOr(mouse, "degPerPx", 0.3),
		},
	}
}

func axisOr(m map[string]any) string {
	if m["axis"] == "y" {
		return "y"
	}
	return "x"
}

func directionOr(m map[string]any) string {
	if m["dir"] == "ccw" || m["direction"] == "ccw" {
		return "ccw"
	}
	return "cw"
}

func fitOr(m map[string]any) string {
	if m["fit"] == "cover" {
		return "cover"
	}
	return "contain"
}

package orbit360

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"math"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"testing"
)

func projectRoot(t *testing.T) string {
	t.Helper()
	dir, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	return filepath.Clean(filepath.Join(dir, "..", ".."))
}

func readJSON(t *testing.T, file string) map[string]any {
	t.Helper()
	data, err := os.ReadFile(file)
	if err != nil {
		t.Fatal(err)
	}
	var value map[string]any
	if err := json.Unmarshal(data, &value); err != nil {
		t.Fatal(err)
	}
	return value
}

func jsonFiles(t *testing.T, dir string) []string {
	t.Helper()
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	files := make([]string, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".json") {
			files = append(files, filepath.Join(dir, entry.Name()))
		}
	}
	sort.Strings(files)
	return files
}

func compareValue(t *testing.T, actual, expected any, where string) {
	t.Helper()
	switch value := expected.(type) {
	case float64:
		number, ok := actual.(float64)
		if !ok {
			t.Fatalf("%s: expected number, got %T", where, actual)
		}
		if math.Abs(number-value) > 1e-6 {
			t.Fatalf("%s: %v != %v", where, number, value)
		}
	case []any:
		values, ok := actual.([]any)
		if !ok || len(values) != len(value) {
			t.Fatalf("%s: expected array of %d", where, len(value))
		}
		for index := range value {
			compareValue(t, values[index], value[index], where+"["+strconv.Itoa(index)+"]")
		}
	case map[string]any:
		values, ok := actual.(map[string]any)
		if !ok {
			t.Fatalf("%s: expected object, got %T", where, actual)
		}
		for key, item := range value {
			compareValue(t, values[key], item, where+"."+key)
		}
	default:
		if !reflect.DeepEqual(actual, expected) {
			t.Fatalf("%s: %v != %v", where, actual, expected)
		}
	}
}

func TestParserConformance(t *testing.T) {
	root := projectRoot(t)
	for _, file := range jsonFiles(t, filepath.Join(root, "conformance", "parser")) {
		item := readJSON(t, file)
		name := item["name"].(string)
		t.Run(name, func(t *testing.T) {
			bytes, err := os.ReadFile(filepath.Join(root, item["file"].(string)))
			if err != nil {
				t.Fatal(err)
			}
			expect := item["expect"].(map[string]any)
			if expect["success"] == true {
				bundle, err := Parse(bytes)
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				if bundle.Header.FrameCount != uint32(expect["frameCount"].(float64)) {
					t.Fatalf("frameCount")
				}
				if len(bundle.Meta.Videos) != int(expect["videoCount"].(float64)) {
					t.Fatalf("videoCount")
				}
				for videoIndex, frames := range expect["frames"].([]any) {
					for frameIndex, expectedBase64 := range frames.([]any) {
						data, err := bundle.FrameBytes(videoIndex, frameIndex)
						if err != nil {
							t.Fatal(err)
						}
						if base64.StdEncoding.EncodeToString(data) != expectedBase64.(string) {
							t.Fatalf("frame %d/%d mismatch", videoIndex, frameIndex)
						}
					}
				}
			} else {
				_, err := Parse(bytes)
				var orbErr *OrbError
				if !errors.As(err, &orbErr) {
					t.Fatalf("expected OrbError, got %v", err)
				}
				if orbErr.Code != expect["errorCode"].(string) {
					t.Fatalf("expected %s, got %s", expect["errorCode"], orbErr.Code)
				}
			}
		})
	}
}

func applyEvent(t *testing.T, engine *Engine, event map[string]any) {
	t.Helper()
	kind := event["type"].(string)
	number := func(key string) float64 { return event[key].(float64) }
	switch kind {
	case "setAngle":
		engine.SetAngle(number("angle"), event["immediate"] == true)
	case "rotateBy":
		engine.RotateBy(number("deg"))
	case "pointerDown":
		engine.PointerDown(number("x"), number("y"), number("timeMs"))
	case "pointerMove":
		engine.PointerMove(number("x"), number("y"), number("timeMs"))
	case "pointerUp":
		engine.PointerUp(number("timeMs"))
	case "gyro":
		engine.Gyro(number("heading"), number("timeMs"))
	case "advance":
		engine.Advance(number("dtMs"))
	case "pause":
		engine.Pause()
	case "resume":
		engine.Resume()
	case "reset":
		angle := 0.0
		if value, ok := event["angle"].(float64); ok {
			angle = value
		}
		engine.Reset(angle, event["immediate"] != false)
	case "load":
		data, _ := json.Marshal(event["bundle"])
		var bundle EngineBundle
		if err := json.Unmarshal(data, &bundle); err != nil {
			t.Fatal(err)
		}
		engine.Load(bundle)
	case "unload":
		engine.Unload()
	case "destroy":
		engine.Destroy()
	case "setConfig":
		config, _ := event["config"].(map[string]any)
		engine.SetConfig(config)
	default:
		t.Fatalf("unknown event: %s", kind)
	}
}

func runEngineCases(t *testing.T, root, dir string) {
	for _, file := range jsonFiles(t, filepath.Join(root, "conformance", dir)) {
		item := readJSON(t, file)
		name := item["name"].(string)
		t.Run(name, func(t *testing.T) {
			data, err := json.Marshal(item["bundle"])
			if err != nil {
				t.Fatal(err)
			}
			var bundle EngineBundle
			if err := json.Unmarshal(data, &bundle); err != nil {
				t.Fatal(err)
			}
			config, _ := item["config"].(map[string]any)
			engine := NewEngine(bundle, config)
			for _, event := range item["events"].([]any) {
				applyEvent(t, engine, event.(map[string]any))
			}
			actualData, _ := json.Marshal(engine.GetSnapshot())
			var actual map[string]any
			if err := json.Unmarshal(actualData, &actual); err != nil {
				t.Fatal(err)
			}
			compareValue(t, actual, item["expect"], name)
		})
	}
}

func TestEngineConformance(t *testing.T) {
	runEngineCases(t, projectRoot(t), "engine")
}

func TestLifecycleConformance(t *testing.T) {
	runEngineCases(t, projectRoot(t), "lifecycle")
}

func TestLayoutConformance(t *testing.T) {
	root := projectRoot(t)
	for _, file := range jsonFiles(t, filepath.Join(root, "conformance", "layout")) {
		item := readJSON(t, file)
		name := item["name"].(string)
		t.Run(name, func(t *testing.T) {
			data, _ := json.Marshal(item)
			var layoutCase struct {
				Canvas        Canvas             `json:"canvas"`
				Viewport      Canvas             `json:"viewport"`
				Fit           string             `json:"fit"`
				DisplayScale  *float64           `json:"displayScale"`
				PortraitScale *float64           `json:"portraitScale"`
				DPR           float64            `json:"dpr"`
				Layers        []LayoutLayerInput `json:"layers"`
			}
			if err := json.Unmarshal(data, &layoutCase); err != nil {
				t.Fatal(err)
			}
			plan := ComputeLayout(LayoutInput{
				Canvas:        layoutCase.Canvas,
				Viewport:      layoutCase.Viewport,
				Fit:           layoutCase.Fit,
				DisplayScale:  layoutCase.DisplayScale,
				PortraitScale: layoutCase.PortraitScale,
				DPR:           layoutCase.DPR,
				Layers:        layoutCase.Layers,
			})
			actualData, _ := json.Marshal(plan)
			var actual map[string]any
			if err := json.Unmarshal(actualData, &actual); err != nil {
				t.Fatal(err)
			}
			compareValue(t, actual, item["expect"], name)
		})
	}
}

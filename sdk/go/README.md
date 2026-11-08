# Orbit360 Go SDK

ORB3/v1 解析器、确定性 `OrbitEngine` 与布局计算，无第三方依赖。

```bash
cd sdk/go
go test ./...
```

```go
bundle, err := orbit360.Parse(data)
if err != nil {
    var orbErr *orbit360.OrbError
    if errors.As(err, &orbErr) {
        log.Println(orbErr.Code) // 稳定错误码
    }
}

frame, err := bundle.FrameBytes(0, 0)

engine := orbit360.NewEngine(orbit360.EngineBundle{
    Canvas: orbit360.Canvas{Width: 1280, Height: 720},
    Videos: []orbit360.EngineLayerInput{{
        Rect:       orbit360.Rect{Width: 1280, Height: 720},
        FrameCount: 36,
    }},
}, nil)
engine.SetAngle(90, true)
engine.Advance(16)
snapshot := engine.GetSnapshot()
```

测试读取仓库根 `fixtures/` 与 `conformance/`，与 Web / Flutter / 小程序使用同一批用例。

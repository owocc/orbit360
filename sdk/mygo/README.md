# Orbit360 MyGo SDK

MyGo 桌面渲染适配器：`sdk/go` 负责 ORB3/v1 解析、`OrbitEngine` 与布局，本包只把
`RenderSnapshot` + `RenderPlan` 画进原生窗口。不启动浏览器，也不依赖 WebView。

```text
.orb ──sdk/go Parse──▶ Bundle ──▶ OrbitEngine ──▶ Snapshot
                                    │
                       ComputeLayout ┴──▶ Layer rect ──▶ ui.Bitmap / Painter
```

与 Web / 小程序 / Flutter 使用同一份 `fixtures/` 与 `conformance/`；解析、引擎和布局
不在这里另写一套。模块通过 `replace` 引用仓库内的 `sdk/go`，随仓库一起开发。

## 用法

```go
import (
	"github.com/egoist/mygo/ui"
	orbit360 "github.com/owocc/orbit360/sdk/mygo"
)

preview := orbit360.NewClient(orbit360.Options{
	Fit:       orbit360.FitContain,
	Auto:      orbit360.AutoOff,
	CacheSize: 24,
})
defer preview.Close()

if err := preview.LoadFile("assets/orbit/scene.orb"); err != nil {
	log.Fatal(err)
}

ui.Column(c).Fill().Children(func() {
	preview.View(c).Grow(1) // 拖拽转动 + 自动环绕 + 帧缓存
})
```

`View` 每帧推进引擎：读取指针拖拽增量、调用 `Advance(dt)`，再由 `Snapshot` 决定帧号。
自动环绕、惯性、阻尼还在运行时它会请求动画帧，静止后自动停下。

也可以先读字节再解析，或直接接管已有的 Bundle：

```go
client := orbit360.NewClient()
if err := client.Load(data); err != nil {
	log.Fatal(err) // *sdk/go.OrbError，带稳定错误码
}
client.SetBundle(bundle)
```

## API

| 方法 | 说明 |
| --- | --- |
| `NewClient(opts ...Options) *Client` | 创建客户端，零值沿用场景包配置 |
| `LoadFile(path)` / `Load(data)` | 解析并替换场景；失败时保留当前场景 |
| `SetBundle(*orbit360.Bundle)` | 直接接管已解析的场景包（只读） |
| `Bundle()` / `Meta()` | 当前场景包与元数据 |
| `View(*ui.Context) ui.Element` | 渲染元素，放进任意 MyGo 布局 |
| `Snapshot()` | 引擎快照（角度、帧号、自动环绕、图层帧号） |
| `SetConfig(map[string]any)` / `ResetConfig()` | 覆盖引擎配置，字段见 `spec/orbit-config.md` |
| `SetFit(FitContain / FitCover)` / `Fit()` | 画面适应方式 |
| `SetAuto(AutoOff / AutoCW / AutoCCW)` / `Auto()` | 自动环绕 |
| `SetAngle(deg, immediate)` / `RotateBy(deg)` / `Angle()` | 角度控制 |
| `Reset()` / `ResetTo(deg, immediate)` | 回到初始角度 / 指定角度 |
| `FrameIndex()` | 当前主视频帧号 |
| `Pause()` / `Resume()` | 暂停 / 恢复推进 |
| `EnableGyro()` / `DisableGyro()` / `CalibrateGyro()` / `Gyro(heading)` | 陀螺仪接入 |
| `Close()` | 释放引擎与帧缓存 |
| `Error()` | 最近一次解码错误 |

`Options.Config` 会原样合并到用户配置，例如：

```go
client.SetConfig(map[string]any{
	"auto": map[string]any{"degPerSec": 24, "idleDelayMs": 1200},
	"drag": map[string]any{"degPerPx": 0.5},
})
```

配置在重新 `Load` 后仍然生效；`ResetConfig` 才会回到场景包自己的值。

## 输入与时间

`View` 内部把 MyGo 的 `Dragged()` 增量转成 `PointerDown / PointerMove / PointerUp`，
轴（`x` / `y`）、灵敏度、反转、惯性都交给 `OrbitEngine`，与 Web 客户端一致。

陀螺仪由宿主转发采样。桌面端可以接系统传感器；没有传感器时不调用即可：

```go
client.EnableGyro()
client.Gyro(heading)          // 度，内部时钟
client.CalibrateGyro()
```

## 帧解码与缓存

帧数据来自 `Bundle.FrameBytes`，用 `ui.DecodeBitmap` 解码成 `ui.Bitmap`，默认缓存最近
24 帧（`Options.CacheSize` / `SetCacheSize`）。支持 WebP / JPEG / PNG；AVIF 桌面解码器
不支持，会提示改用 `--codec webp`。多视频场景按 `Snapshot.Layers` 的矩形叠放。

## 测试

```bash
cd sdk/mygo
go test ./...
```

测试直接回放仓库的 `conformance/parser` 用例，并用 `assets/orbit/scene.orb` 验证渲染、
缓存和配置生命周期。引擎与布局的跨平台一致性由 `sdk/go` 的 conformance 覆盖。

# `@orbit360/mygo`

ORB3（`.orb`）的 Go 解析器 + MyGo 原生渲染层。桌面环境直接用 Go 解码帧、画进 MyGo 窗口，
不启动浏览器、不依赖 WebView。

```
sdk/mygo/
  orb.go        ORB3 解析（Header / Meta / Index / Frame）
  client.go     角度、拖拽、自动环绕、fit、帧缓存与 MyGo View
  *_test.go     解析与桌面渲染测试
```

## 安装

模块路径是 `github.com/owocc/orbit360/sdk/mygo`。仓库内的 `apps/gui` 用 `replace` 指到本地：

```go
require github.com/owocc/orbit360/sdk/mygo v0.0.0

replace github.com/owocc/orbit360/sdk/mygo => ../../sdk/mygo
```

需要 Go 1.27+ 与 [MyGo](https://github.com/egoist/mygo) `v0.7.4`。

## 解析

```go
import orbit360 "github.com/owocc/orbit360/sdk/mygo"

b, err := orbit360.Open("assets/maid/scene.orb")
if err != nil {
	return err
}
defer b.Close()

b.Meta.Title       // 场景标题
b.Meta.Canvas      // {Width, Height}
b.Count()          // 最大视频帧数
b.Resolved()       // 补齐缺省值后的 axis / spanDeg / direction / minAngle / maxAngle

entry, _ := b.FrameEntry(0, 12)
data, _ := b.Frame(0, 12) // 原始 WebP / JPEG / PNG 字节
```

也可以用 `OpenReaderAt` 从文件、内存或 HTTP Range 读取器解析：

```go
b, err := orbit360.OpenReaderAt(readerAt, size)
```

解析器按 `sdk/js/src/orb.ts` 的规则校验 magic、版本（1.0 / 1.1 / 1.2）、`prefixLen`、
`indexLen`、索引连续性、`videos[].frames.indexStart`、`totalFrames`、`rect` 越界、
`orbit.axis` 与 `minAngle/maxAngle`。失败信息以 `ORB3:` 开头。

## 渲染

`Client.View(ctx)` 返回一个可放进任意布局的 MyGo 元素，内部处理拖拽、自动环绕与帧缓存：

```go
import (
	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
	orbit360 "github.com/owocc/orbit360/sdk/mygo"
)

var preview *orbit360.Client

func main() {
	preview = orbit360.NewClient(nil, orbit360.Options{
		Auto:   orbit360.AutoCW,
		Speed:  14,
		Fit:    orbit360.FitContain,
	})
	if err := preview.LoadFile("assets/maid/scene.orb"); err != nil {
		log.Fatal(err)
	}
	defer preview.Close()

	mygo.App.WhenReady(func() {
		mygo.NewWindow(mygo.WindowOptions{
			Title:   "Orbit360",
			Width:   960,
			Height:  640,
			Content: ui.View(func(c *ui.Context) {
				ui.Column(c).Fill().Children(func() {
					preview.View(c).Grow(1)
				})
			}),
		})
	})
	log.Fatal(mygo.App.Run())
}
```

| 方法 | 作用 |
| --- | --- |
| `NewClient(b, Options{...})` | 创建客户端；`b` 可为 `nil`，稍后 `LoadFile` / `SetBundle` |
| `LoadFile(path)` / `SetBundle(b)` | 打开 / 替换场景 |
| `View(c)` | 构建渲染元素（拖拽转动、自动环绕、帧映射） |
| `SetAuto(AutoOff / AutoCW / AutoCCW)` | 自动环绕 |
| `SetFit(FitContain / FitCover)` | 自适应 / 铺满 |
| `SetSpeed(degPerSec)` / `SetInvert(bool)` | 自动速度 / 翻转拖拽 |
| `SetAngle(deg)` / `RotateBy(deg)` / `Reset()` | 角度控制 |
| `Angle()` / `FrameIndex()` / `Meta()` / `Bundle()` | 读取状态 |
| `Error()` | 最近一次加载 / 解码错误 |
| `Close()` | 关闭场景包并释放帧缓存 |

`Options.CacheSize` 默认缓存最近 24 帧（1280×720 的 RGBA 约 3.7 MB/帧）。场景很大时可以调小；
来回拖拽时缓存命中，不会重复解码。

## 解码支持

MyGo 的 `ui.DecodeBitmap` 支持 WebP / JPEG / PNG / GIF（首帧）/ BMP。
**AVIF 不支持**：遇到 `image/avif` 会返回明确错误，重新生成时用默认的 `--codec webp` 即可。

缩放规则与网页客户端一致：画布按 `meta.canvas` 计算，`FitContain` 完整显示、`FitCover` 铺满裁切；
多视频按 `videos[].rect` 叠放。角度语义为 `-180..180`（右正左负），帧号按 `spanDeg` 居中映射，
`orbit.direction=ccw` 时反向取帧；有限角度区间会钳制拖拽和自动环绕。

# @orbit360/expo-render

ORB3 场景包解析与 Expo / React Native 原生多角度渲染 SDK。

## 功能

- 支持加载与解析 `.orb` 二进制场景包（Bundle Header、Meta、索引、图像帧切片）
- 360 度环绕控制：触摸拖拽、惯性阻尼、平滑转动、自动旋转、陀螺仪偏航与俯仰
- 自适应（contain）与铺满（cover）多层视频渲染
- 与 Web 端 `Orbit360Client` 及 Flutter 端 `orbit360_render` 行为完全一致

## 安装

```bash
pnpm add @orbit360/expo-render
```

## 使用示例

```tsx
import { OrbitRenderController, OrbitRenderWidget } from "@orbit360/expo-render";
import { useEffect, useRef } from "react";
import { View } from "react-native";

export default function Player() {
  const controllerRef = useRef(new OrbitRenderController());

  useEffect(() => {
    controllerRef.current.loadUrl("https://example.com/scene.orb");
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <OrbitRenderWidget controller={controllerRef.current} />
    </View>
  );
}
```

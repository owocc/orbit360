# 版本与兼容策略

版本彼此独立：

```text
ORB 文件格式版本：ORB3/v1（Header version = 0x00010002）
解析 API 版本：  parser/v1
引擎行为版本：    engine/v1
各语言 SDK：      独立 SemVer
```

## 规则

1. 所有 SDK 只接受 `0x00010002`。其他版本返回 `ORB_UNSUPPORTED_VERSION`，不做兼容读取。
2. 修改 Header、Meta、Index 或帧数据布局时，升级 ORB 格式版本。
3. 修改角度、帧索引、惯性、自动旋转、陀螺仪或生命周期语义时，升级 engine 行为版本，并更新全部 conformance cases。
4. 只修复实现 bug、不改变规范时，只增加对应 SDK 的 patch 版本。
5. 新增 conformance case 后，所有平台必须通过；任何平台不得维护私有 expected values。
6. `message` 文本、日志、内部类型不构成兼容契约。

## 单一事实来源

```text
spec/ + fixtures/ + conformance/
        ↓
Web TypeScript / Flutter Dart / Go / 微信 / 抖音
```

Web TypeScript 是第一版参考实现，不是其他语言的运行时依赖。规范、fixtures 和 conformance cases 是唯一事实来源。

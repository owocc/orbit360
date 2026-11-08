# ORB3 规范

| 文件                                     | 内容                                              |
| ---------------------------------------- | ------------------------------------------------- |
| [orb3-format.md](orb3-format.md)         | Header、Meta、Index、帧数据的二进制布局           |
| [orb3-validation.md](orb3-validation.md) | 校验顺序与错误条件                                |
| [orbit-api.md](orbit-api.md)             | 配置、角度、帧索引、事件与生命周期                |
| [render-snapshot.md](render-snapshot.md) | EngineSnapshot、RenderPlan 与布局                 |
| [errors.md](errors.md)                   | 稳定错误码                                        |
| [compatibility.md](compatibility.md)     | 版本与兼容策略                                    |
| `schema/`                                | Meta、配置、快照、conformance case 的 JSON Schema |

规范、`fixtures/` 和 `conformance/` 是唯一事实来源。实现必须通过同一批用例；
测试不得动态调用某个实现生成期望值。

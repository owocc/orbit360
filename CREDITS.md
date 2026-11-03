# 致谢

## 灵感来源

本项目由 monoradio（[@monoradio102](https://x.com/monoradio102)）的一条帖子启发：

> [x.com/monoradio102/status/2116746974716432602](https://x.com/monoradio102/status/2116746974716432602)（2026-11-01）
> 「スマホの傾きに合わせて、絵が回るようにしてみた。3D化しているわけではなく、1枚の絵から
> 360°回転の『動画』を作り、傾きに合わせてフレームを前後させて、立体っぽく見せています。
> #MiniMaxH3 + ORB360 LoRA」

即：把环绕旋转的画面当成帧序列，按手机倾斜角度切换帧，做出「可以转的立体」效果。
后来对方也公开了可交互的演示页：<https://monoradio102.github.io/tilt-to-peek/>。

本项目与其作者无隶属、合作或授权关系；名称相近只是为了描述同一类效果。

## 素材

`videos/*.mp4` 与 `assets/*/scene.orb` 里的画面由 AI 视频生成工具产出，按现状提供用于功能演示。
AI 生成物的可版权性在各国规定不一，画面能否再分发、能否商用还受生成工具服务条款约束；
若画面与任何现有角色、人物形象或商标相似，不构成对这些形象的授权。

替换示例素材不需要改页面：

```bash
python3 scripts/bundle.py build assets/<id>/scene.orb <你的视频> --fps 12 --long-edge 1280
```

## 许可

代码采用 [PolyForm Noncommercial License 1.0.0](LICENSE)：源码公开，非商业用途免费，
商业用途需书面授权。详见 [README 的「许可」一节](README.md#许可)。

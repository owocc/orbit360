import React from "react";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "./ui/Dialog";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-800/80 bg-neutral-950/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-3 group">
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-100 group-hover:bg-neutral-300 transition-colors" />
            <span className="font-mono text-base font-semibold tracking-tight text-white">
              orbit360
            </span>
            <span className="hidden sm:inline-block font-mono text-[10px] uppercase tracking-widest text-neutral-400 border border-neutral-800 px-1.5 py-0.5 rounded">
              v0.1.0-web
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-mono">
            <a
              href="#showcase"
              className="text-neutral-400 hover:text-neutral-100 transition-colors"
            >
              多维视窗
            </a>
            <a href="#matrix" className="text-neutral-400 hover:text-neutral-100 transition-colors">
              架构与能力
            </a>
            <a
              href="#comparison"
              className="text-neutral-400 hover:text-neutral-100 transition-colors"
            >
              特性对比
            </a>
            <a
              href="#integration"
              className="text-neutral-400 hover:text-neutral-100 transition-colors"
            >
              快速集成
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Dialog>
            <DialogTrigger className="px-3 py-1.5 text-xs font-mono rounded border border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-700 hover:text-white transition-colors">
              查看 SDK 规范
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Orbit360 SDK 协议与二进制规范</DialogTitle>
              <DialogDescription>
                .orb 是基于单文件二进制包的零拷贝帧序列格式。客户端通过 HTTP Range Header
                单次请求头部索引表，随后根据渲染视角与拖拽角速度精确请求单帧像素，无需在内存中解码整个视频轨。
              </DialogDescription>
              <div className="mt-4 p-3 bg-neutral-900 border border-neutral-800 rounded font-mono text-[11px] text-neutral-300 space-y-2">
                <div className="text-neutral-400"># 核心指令</div>
                <div className="text-neutral-200">
                  python3 scripts/bundle.py build scene.orb input.mp4 --fps 12 --long-edge 1280
                </div>
                <div className="text-neutral-400"># 关键特性</div>
                <div className="text-neutral-400">
                  - 纯 Canvas 单帧硬切，消除全视频解码能耗与显存占用
                  <br />- 支持传感器 Gyroscope / Pointer 拖动惯性算法
                  <br />- 单页面支持数十个独立 Canvas 实例流畅互不干扰
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <DialogClose className="px-3 py-1.5 text-xs font-mono rounded bg-neutral-800 text-neutral-200 hover:bg-neutral-700 transition-colors">
                  关闭
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>

          <a
            href="https://github.com/owocc/orbit360"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 text-xs font-mono rounded bg-white text-neutral-950 font-medium hover:bg-neutral-200 transition-colors"
          >
            源码仓库
          </a>
        </div>
      </div>
    </header>
  );
}

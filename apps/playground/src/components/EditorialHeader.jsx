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

export function EditorialHeader() {
  return (
    <header className="border-b-2 border-neutral-900 bg-[#fbf9f4] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* 左侧 Logo 与描述 */}
        <div className="flex items-center gap-6 sm:gap-10">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="font-mono text-xl sm:text-2xl font-black tracking-tighter text-black">
              orbit360<span className="text-[#ff4e7e]">.</span>
            </span>
          </Link>

          <div className="hidden md:flex flex-col text-[10px] font-mono leading-tight text-neutral-600 border-l border-neutral-300 pl-4">
            <span className="font-bold text-neutral-900">PUBLIC 3D LAB NOTEBOOK</span>
            <span className="text-neutral-500">CREATIVE FRAME ENGINE</span>
          </div>
        </div>

        {/* 中间版本号信息 */}
        <div className="hidden lg:flex items-center gap-2 font-mono text-[11px] text-neutral-700 bg-white border border-neutral-300 px-3 py-1 rounded">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>VERSION 0.1.0 · ALWAYS IN BETA</span>
        </div>

        {/* 右侧动作 */}
        <div className="flex items-center gap-3">
          <Dialog>
            <DialogTrigger className="px-3 py-1 text-xs font-mono font-bold border-2 border-neutral-900 bg-white text-black shadow-[2px_2px_0px_#000000] hover:bg-neutral-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#000000] transition-all">
              MANIFESTO
            </DialogTrigger>
            <DialogContent className="bg-[#fbf9f4] text-neutral-900 border-2 border-neutral-900 shadow-[8px_8px_0px_#000000]">
              <DialogTitle className="text-xl font-black tracking-tight text-black font-mono">
                ORBIT360 MANIFESTO
              </DialogTitle>
              <DialogDescription className="text-neutral-700 text-xs font-mono leading-relaxed mt-2">
                这里不是臃肿的 3D 模型展厅，而是轻量、高效的环绕切帧实验室。
              </DialogDescription>
              <div className="my-4 p-4 bg-white border-2 border-neutral-900 rounded font-mono text-xs text-neutral-800 space-y-3 shadow-[3px_3px_0px_#000000]">
                <div>
                  <span className="font-bold text-black">[01] 拒绝冗余 WebGL 显存浪费</span>
                  <p className="text-neutral-600 text-[11px] mt-0.5">
                    普通环绕视频经抽帧压缩仅占数兆字节，单帧硬切无能耗负担。
                  </p>
                </div>
                <div>
                  <span className="font-bold text-black">[02] 任意遮罩与透明背景适配</span>
                  <p className="text-neutral-600 text-[11px] mt-0.5">
                    支持拱形、胶囊、菱形等多形态 Mask 裁剪，背后可无限扩展衬托图形与粒子。
                  </p>
                </div>
                <div>
                  <span className="font-bold text-black">[03] 响应式多实例并发</span>
                  <p className="text-neutral-600 text-[11px] mt-0.5">
                    单个页面可随心排列数十个微型 360° 视窗，无性能掉帧隐患。
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <DialogClose className="px-4 py-1.5 text-xs font-mono font-bold bg-neutral-900 text-white rounded border border-black hover:bg-black transition-colors">
                  CLOSE
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>

          <a
            href="https://github.com/owocc/orbit360"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-1 text-xs font-mono font-bold border-2 border-neutral-900 bg-neutral-900 text-white shadow-[2px_2px_0px_#000000] hover:bg-neutral-800 transition-all"
          >
            INDEX
          </a>
        </div>
      </div>
    </header>
  );
}

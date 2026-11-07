import React, { useRef, useState } from "react";
import { useLoaderData, useRouter } from "@tanstack/react-router";
import { LazyCoverCard } from "./LazyCoverCard";
import { useFlipFocus } from "./FlipFocusModal";
import { validateBrowserOrbFile } from "../lib/orb-file.js";
import * as m from "../paraglide/messages.js";

function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function uploadAspect(item) {
  const width = Number(item.width);
  const height = Number(item.height);
  if (width > 0 && height > 0) {
    const ratio = Math.min(Math.max(width / height, 0.6), 1.8);
    return `${ratio}`;
  }
  return "4 / 3";
}

function errorMessage(code) {
  switch (code) {
    case "empty_file":
      return m.gallery_error_empty();
    case "too_large":
      return m.gallery_error_too_large();
    case "bad_name":
      return m.gallery_error_bad_name();
    case "invalid_orb":
      return m.gallery_error_invalid();
    default:
      return m.gallery_upload_failed();
  }
}

export default function GalleryPage() {
  const cardRefs = useRef({});
  const fileInputRef = useRef(null);
  const { focusCard } = useFlipFocus();
  const router = useRouter();
  const uploads = useLoaderData({ from: "/gallery" }) || [];
  const [uploadState, setUploadState] = useState({ status: "idle", message: "" });

  // 瀑布流画廊数据集：提供不同高宽比，模拟错落有致的瀑布流效果
  const galleryItems = [
    { id: "gal-1", materialId: "maid", aspect: "3/4", speed: 12 },
    { id: "gal-2", materialId: "orbit", aspect: "1/1", speed: -10 },
    { id: "gal-3", materialId: "maid", aspect: "4/5", speed: 14 },
    { id: "gal-4", materialId: "orbit", aspect: "9/16", speed: 8 },
    { id: "gal-5", materialId: "maid", aspect: "1/1", speed: -15 },
    { id: "gal-6", materialId: "orbit", aspect: "3/4", speed: 16 },
    { id: "gal-7", materialId: "maid", aspect: "16/10", speed: 10 },
    { id: "gal-8", materialId: "orbit", aspect: "4/5", speed: -12 },
    { id: "gal-9", materialId: "maid", aspect: "3/4", speed: 15 },
  ];

  const openFocus = (id, cardHandle) => {
    const containerEl = cardHandle?.getContainer();
    if (!containerEl) return;
    focusCard({ id, clientRef: { current: cardHandle.getClient() } }, containerEl);
  };

  const handleFile = async (file) => {
    if (!file) return;
    setUploadState({ status: "uploading", message: m.gallery_uploading() });

    const validation = await validateBrowserOrbFile(file);
    if (!validation.ok) {
      setUploadState({ status: "error", message: errorMessage(validation.code) });
      return;
    }

    const body = new FormData();
    body.append("file", file);

    try {
      const response = await fetch("/api/orbs", { method: "POST", body });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setUploadState({ status: "error", message: errorMessage(payload.error) });
        return;
      }
      setUploadState({ status: "success", message: m.gallery_upload_success() });
      await router.invalidate();
    } catch {
      setUploadState({ status: "error", message: m.gallery_upload_failed() });
    }
  };

  const uploading = uploadState.status === "uploading";

  return (
    <div className="w-full pt-10 pb-24 px-4 sm:px-8 max-w-7xl mx-auto">
      {/* 头部标题与上传入口 */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-6 sm:justify-between mb-14">
        <div className="text-center sm:text-left max-w-xl">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white font-sans">
            Specimen Waterfall
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-2.5 font-sans leading-relaxed">
            On-demand loaded gallery in masonry layout. Cards load purely static cover preview
            first, and instantiate 360° Canvas on demand.
          </p>
        </div>

        <div className="flex flex-col items-center sm:items-end gap-1.5 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".orb,application/octet-stream"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void handleFile(file);
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold shadow-sm hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors disabled:opacity-50 disabled:cursor-wait cursor-pointer"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 16V4m0 0L7 9m5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
            </svg>
            {uploading ? m.gallery_uploading() : m.gallery_upload_btn()}
          </button>
          <span className="font-mono text-[10px] text-neutral-400 dark:text-neutral-500">
            {m.gallery_upload_hint()}
          </span>
          {uploadState.status === "error" ? (
            <span className="text-[11px] text-red-500">{uploadState.message}</span>
          ) : uploadState.status === "success" ? (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
              {uploadState.message}
            </span>
          ) : null}
        </div>
      </div>

      {/* 瀑布流布局 (CSS 多列 Masonry Columns) */}
      <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
        {uploads.map((item) => (
          <div key={item.id} className="break-inside-avoid w-full">
            <LazyCoverCard
              ref={(el) => (cardRefs.current[item.id] = el)}
              src={item.url}
              coverSrc={null}
              title={item.title || item.name}
              subtitle={`${m.gallery_frames({ count: item.frameCount })} · ${formatSize(item.size)}`}
              badge={m.gallery_uploaded_badge()}
              aspectRatio={uploadAspect(item)}
              speed={12}
              onFocusRequest={(cardHandle) => openFocus(item.id, cardHandle)}
            />
          </div>
        ))}

        {galleryItems.map((item) => (
          <div key={item.id} className="break-inside-avoid w-full">
            <LazyCoverCard
              ref={(el) => (cardRefs.current[item.id] = el)}
              materialId={item.materialId}
              aspectRatio={item.aspect}
              speed={item.speed}
              onFocusRequest={(cardHandle) => openFocus(item.id, cardHandle)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from "react";
import { useLoaderData, useRouter } from "@tanstack/react-router";
import { LazyCoverCard } from "./LazyCoverCard";
import { UploadDropzone } from "./UploadDropzone.jsx";
import { useFlipFocus } from "./FlipFocusModal";
import { MAX_ORB_BYTES, validateBrowserOrbFile } from "../lib/orb-file.js";
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
  const [dragActive, setDragActive] = useState(false);

  const openFocus = (id, cardHandle) => {
    const containerEl = cardHandle?.getContainer();
    if (!containerEl) return;
    focusCard({ id, clientRef: { current: cardHandle.getClient() } }, containerEl);
  };

  const handleFile = async (file) => {
    if (!file) return;
    setDragActive(false);
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

  const openPicker = () => fileInputRef.current?.click();

  // 仅当拖入的是文件时，才显示全屏拖拽覆盖层。
  useEffect(() => {
    const hasFiles = (event) => Array.from(event.dataTransfer?.types || []).includes("Files");

    const onDragEnter = (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      setDragActive(true);
    };
    const onDragOver = (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
    };
    const onDragLeave = (event) => {
      if (!event.relatedTarget) setDragActive(false);
    };
    const onDrop = () => setDragActive(false);
    const onDragEnd = () => setDragActive(false);

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragend", onDragEnd);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragend", onDragEnd);
    };
  }, []);

  const uploading = uploadState.status === "uploading";

  return (
    <div className="w-full pt-10 pb-24 px-4 sm:px-8 max-w-7xl mx-auto">
      <input
        ref={fileInputRef}
        type="file"
        accept=".orb"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void handleFile(file);
        }}
      />

      {/* 头部标题与分享入口 */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-6 sm:justify-between mb-14">
        <div className="text-center sm:text-left max-w-xl">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white font-sans">
            Specimen Waterfall
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-2.5 font-sans leading-relaxed">
            {m.gallery_desc()}
          </p>
        </div>

        <div className="flex flex-col items-center sm:items-end gap-1.5 shrink-0">
          <button
            type="button"
            disabled={uploading}
            onClick={openPicker}
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
            {uploading ? m.gallery_uploading() : m.gallery_share_btn()}
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

      {uploads.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 px-6 py-20 text-center">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white font-sans">
            {m.gallery_empty_title()}
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-2 font-sans">
            {m.gallery_empty_hint()}
          </p>
          <button
            type="button"
            disabled={uploading}
            onClick={openPicker}
            className="mt-6 inline-flex items-center px-5 py-2.5 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {uploading ? m.gallery_uploading() : m.gallery_share_btn()}
          </button>
        </div>
      ) : (
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
        </div>
      )}

      {/* 只有拖入文件时才出现的全屏覆盖上传层 */}
      {dragActive ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-neutral-950/75 backdrop-blur-sm p-6"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            const handledByZone = event.defaultPrevented;
            event.preventDefault();
            setDragActive(false);
            if (handledByZone) return;
            const file = event.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
        >
          <div className="w-full max-w-[560px] rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-2xl">
            <UploadDropzone
              instant
              speed={100}
              extensions={["orb"]}
              maxBytes={MAX_ORB_BYTES}
              style={{ width: "100%", maxWidth: "100%" }}
              labels={{
                idle: m.gallery_drop_title(),
                over: m.gallery_drop_title(),
                hint: m.gallery_drop_hint(),
                uploaded: m.gallery_upload_success(),
                badType: m.gallery_error_bad_name(),
                tooBig: m.gallery_error_too_large(),
              }}
              onFileUploaded={(file) => void handleFile(file)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

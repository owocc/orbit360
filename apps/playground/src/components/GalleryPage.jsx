import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLoaderData, useRouter } from "@tanstack/react-router";
import { fromBlob } from "@orbit360/javascript";
import { LazyCoverCard } from "./LazyCoverCard";
import { Pure3DCard } from "./Pure3DCard";
import { UploadDropzone } from "./UploadDropzone.jsx";
import { useFlipFocus } from "./FlipFocusModal";
import { getOrbsPage } from "../server/orb-functions.js";
import {
  MAX_COVER_BYTES,
  MAX_ORB_BYTES,
  coverExtension,
  orbAspectRatio,
  sniffImageType,
  validateBrowserOrbFile,
} from "../lib/orb-file.js";
import * as m from "../paraglide/messages.js";

function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function uploadAspect(item) {
  const ratio = Number(item.aspectRatio) || orbAspectRatio(item.width, item.height);
  return `${Math.min(Math.max(ratio, 0.75), 1.6)}`;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

/** PC 三列、平板两列、手机一列；只按下标分组，不测量卡片高度。 */
function useColumnCount() {
  const [count, setCount] = useState(3);

  useEffect(() => {
    const sm = window.matchMedia("(min-width: 640px)");
    const lg = window.matchMedia("(min-width: 1024px)");
    const update = () => setCount(lg.matches ? 3 : sm.matches ? 2 : 1);
    update();
    sm.addEventListener("change", update);
    lg.addEventListener("change", update);
    return () => {
      sm.removeEventListener("change", update);
      lg.removeEventListener("change", update);
    };
  }, []);

  return count;
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
    case "invalid_cover":
      return m.gallery_invalid_cover();
    default:
      return m.gallery_upload_failed();
  }
}

function uploadOrb(body, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/orbs");
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener("load", () => {
      let payload = {};
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        /* ignore invalid body */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload);
      } else {
        reject(
          Object.assign(new Error(payload.message || "upload failed"), { code: payload.error }),
        );
      }
    });
    xhr.addEventListener("error", () => reject(new Error("network error")));
    xhr.send(body);
  });
}

async function buildDraft(file) {
  const bundle = await fromBlob(file);
  const frame = bundle.frameBlob(0, 0);
  if (frame.size > MAX_COVER_BYTES) throw new Error("cover too large");

  const head = await frame.slice(0, 16).arrayBuffer();
  const type = sniffImageType(head);
  const ext = coverExtension(type);
  if (!type || !ext) throw new Error("unsupported cover format");

  const cover = new File([frame], `cover.${ext}`, { type });
  const meta = bundle.meta || {};
  const width = Number(meta.canvas?.width) || null;
  const height = Number(meta.canvas?.height) || null;
  return {
    file,
    cover,
    coverUrl: URL.createObjectURL(cover),
    previewUrl: URL.createObjectURL(file),
    meta,
    frameCount: meta.totalFrames ?? bundle.header.frameCount,
    width,
    height,
    aspectRatio: orbAspectRatio(width, height),
    title: (typeof meta.title === "string" ? meta.title : file.name.replace(/\.orb$/i, "")).slice(
      0,
      120,
    ),
    description: (typeof meta.description === "string" ? meta.description : "").slice(0, 500),
  };
}

export default function GalleryPage() {
  const cardRefs = useRef({});
  const fileInputRef = useRef(null);
  const { focusCard } = useFlipFocus();
  const router = useRouter();
  const initialPage = useLoaderData({ from: "/gallery" }) || { items: [], nextCursor: null };
  const [items, setItems] = useState(initialPage.items);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingRef = useRef(false);
  const sentinelRef = useRef(null);
  const columnCount = useColumnCount();
  const columns = useMemo(() => {
    const next = Array.from({ length: columnCount }, () => []);
    items.forEach((item, index) => next[index % columnCount].push(item));
    return next;
  }, [items, columnCount]);
  const [uploadState, setUploadState] = useState({ status: "idle", message: "" });
  const [dragActive, setDragActive] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [progress, setProgress] = useState(0);

  const uploading = uploadState.status === "uploading";

  useEffect(() => {
    setItems(initialPage.items);
    setNextCursor(initialPage.nextCursor);
  }, [initialPage]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !nextCursor) return;

    let cancelled = false;
    const observer = new IntersectionObserver(
      async (entries) => {
        if (!entries[0]?.isIntersecting || loadingRef.current) return;
        loadingRef.current = true;
        setLoadingMore(true);
        try {
          const page = await getOrbsPage({ data: { cursor: nextCursor } });
          if (cancelled) return;
          setItems((prev) => {
            const seen = new Set(prev.map((item) => item.id));
            return [...prev, ...page.items.filter((item) => !seen.has(item.id))];
          });
          setNextCursor(page.nextCursor);
        } catch {
          // 失败后保持当前列表，下一轮滚动可重试。
        } finally {
          if (!cancelled) {
            loadingRef.current = false;
            setLoadingMore(false);
          }
        }
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
      loadingRef.current = false;
    };
  }, [nextCursor]);

  useEffect(
    () => () => {
      if (draft?.coverUrl) URL.revokeObjectURL(draft.coverUrl);
      if (draft?.previewUrl) URL.revokeObjectURL(draft.previewUrl);
    },
    [draft],
  );

  const openFocus = (id, cardHandle, aspectRatio) => {
    const containerEl = cardHandle?.getContainer();
    if (!containerEl) return;
    focusCard(
      { id, aspectRatio: Number(aspectRatio), clientRef: { current: cardHandle.getClient() } },
      containerEl,
    );
  };

  const prepareFile = async (file) => {
    if (!file || uploading) return;
    setDragActive(false);

    const validation = await validateBrowserOrbFile(file);
    if (!validation.ok) {
      setUploadState({ status: "error", message: errorMessage(validation.code) });
      return;
    }

    setDraft(null);
    setProgress(0);
    setAnalyzing(true);
    setUploadState({ status: "analyzing", message: m.gallery_analysis() });
    try {
      const next = await buildDraft(file);
      setDraft(next);
      setUploadState({ status: "idle", message: "" });
    } catch {
      setUploadState({ status: "error", message: m.gallery_analysis_failed() });
    } finally {
      setAnalyzing(false);
    }
  };

  const closeEditor = () => {
    if (uploading) return;
    setDraft(null);
    setProgress(0);
    setUploadState({ status: "idle", message: "" });
  };

  const startUpload = async () => {
    if (!draft || uploading) return;
    setUploadState({ status: "uploading", message: m.gallery_uploading() });
    setProgress(0);

    const body = new FormData();
    body.append("file", draft.file);
    body.append("cover", draft.cover);
    body.append("title", draft.title);
    body.append("description", draft.description);

    try {
      await uploadOrb(body, setProgress);
      setUploadState({ status: "success", message: m.gallery_upload_success() });
      setDraft(null);
      setProgress(0);
      await router.invalidate();
    } catch (error) {
      setUploadState({ status: "error", message: errorMessage(error.code) });
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

  const overlayOpen = dragActive || analyzing || !!draft;

  return (
    <div className="w-full flex-1 pt-4 sm:pt-6 pb-24 px-4 sm:px-8 max-w-7xl mx-auto">
      <input
        ref={fileInputRef}
        type="file"
        accept=".orb"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void prepareFile(file);
        }}
      />

      {/* 头部标题与分享入口 */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-6 sm:justify-between mb-10">
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
            disabled={uploading || analyzing}
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
            {uploading
              ? `${m.gallery_uploading()} ${progress}%`
              : analyzing
                ? m.gallery_analysis()
                : m.gallery_share_btn()}
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

      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 px-6 py-20 text-center">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white font-sans">
            {m.gallery_empty_title()}
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-2 font-sans">
            {m.gallery_empty_hint()}
          </p>
          <button
            type="button"
            disabled={uploading || analyzing}
            onClick={openPicker}
            className="mt-6 inline-flex items-center px-5 py-2.5 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {uploading ? `${m.gallery_uploading()} ${progress}%` : m.gallery_share_btn()}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {columns.map((column, columnIndex) => (
            <div key={columnIndex} className="grid content-start gap-6">
              {column.map((item) => (
                <div key={item.id} className="w-full">
                  <LazyCoverCard
                    ref={(el) => (cardRefs.current[item.id] = el)}
                    src={item.url}
                    coverSrc={item.cover || null}
                    title={item.title || item.name}
                    subtitle={[
                      formatDate(item.createdAt),
                      m.gallery_frames({ count: item.frameCount }),
                      formatSize(item.size),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    badge={m.gallery_uploaded_badge()}
                    aspectRatio={uploadAspect(item)}
                    onFocusRequest={(cardHandle) =>
                      openFocus(
                        item.id,
                        cardHandle,
                        Number(item.aspectRatio) || orbAspectRatio(item.width, item.height),
                      )
                    }
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {items.length > 0 ? (
        <div ref={sentinelRef} className="py-8 text-center font-mono text-[11px] text-neutral-400">
          {nextCursor ? (loadingMore ? m.gallery_loading_more() : null) : m.gallery_no_more()}
        </div>
      ) : null}

      {/* 全屏覆盖：拖拽 / 分析 / 编辑上传 */}
      {overlayOpen ? (
        <div
          className="fixed inset-0 z-[80] overflow-y-auto bg-neutral-950/75 backdrop-blur-sm p-4 sm:p-6"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            const handledByZone = event.defaultPrevented;
            event.preventDefault();
            setDragActive(false);
            if (handledByZone) return;
            const file = event.dataTransfer.files?.[0];
            if (file) void prepareFile(file);
          }}
        >
          <div className="min-h-full flex items-center justify-center py-6">
            {draft ? (
              <div className="w-full max-w-4xl rounded-3xl bg-white dark:bg-neutral-900 p-5 sm:p-8 shadow-2xl">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white font-sans">
                      {m.gallery_share_btn()}
                    </h2>
                    <p className="text-xs text-neutral-500 mt-1 font-mono">{m.gallery_cover()}</p>
                  </div>
                  <button
                    type="button"
                    onClick={closeEditor}
                    disabled={uploading}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Pure3DCard
                      src={draft.previewUrl}
                      poster={draft.coverUrl}
                      aspectRatio={draft.aspectRatio}
                      autoSpin
                      className="w-full"
                    />
                    <div className="mt-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 space-y-2 text-[11px] font-mono text-neutral-600 dark:text-neutral-400">
                      <div className="text-neutral-400 uppercase tracking-wider">
                        {m.gallery_meta()}
                      </div>
                      <div className="flex justify-between gap-4">
                        <span>{formatSize(draft.file.size)}</span>
                        <span>{m.gallery_frames({ count: draft.frameCount })}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span>
                          {draft.width || "?"} × {draft.height || "?"}
                        </span>
                        <span>{draft.meta?.codec || "ORB3"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        {m.gallery_field_title()}
                      </span>
                      <input
                        value={draft.title}
                        maxLength={120}
                        disabled={uploading}
                        onChange={(event) =>
                          setDraft((prev) => (prev ? { ...prev, title: event.target.value } : prev))
                        }
                        className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-white outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
                      />
                    </label>

                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        {m.gallery_field_description()}
                      </span>
                      <textarea
                        value={draft.description}
                        maxLength={500}
                        rows={4}
                        disabled={uploading}
                        onChange={(event) =>
                          setDraft((prev) =>
                            prev ? { ...prev, description: event.target.value } : prev,
                          )
                        }
                        className="w-full resize-none rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-white outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
                      />
                    </label>

                    {uploading ? (
                      <div className="space-y-1.5">
                        <div className="h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-neutral-900 dark:bg-white transition-[width] duration-200"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="text-right font-mono text-[10px] text-neutral-400">
                          {progress}%
                        </div>
                      </div>
                    ) : null}

                    {uploadState.status === "error" ? (
                      <div className="text-xs text-red-500">{uploadState.message}</div>
                    ) : null}

                    <div className="flex items-center justify-end gap-3 pt-1">
                      <button
                        type="button"
                        onClick={closeEditor}
                        disabled={uploading}
                        className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40 cursor-pointer"
                      >
                        {m.gallery_cancel()}
                      </button>
                      <button
                        type="button"
                        onClick={() => void startUpload()}
                        disabled={uploading}
                        className="px-5 py-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors disabled:opacity-50 disabled:cursor-wait cursor-pointer"
                      >
                        {uploading
                          ? `${m.gallery_uploading()} ${progress}%`
                          : m.gallery_upload_now()}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : analyzing ? (
              <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-neutral-900 p-8 shadow-2xl text-center space-y-4">
                <div className="mx-auto w-10 h-10 rounded-full border-2 border-neutral-200 border-t-neutral-900 dark:border-neutral-800 dark:border-t-white animate-spin" />
                <div className="text-sm font-medium text-neutral-900 dark:text-white font-sans">
                  {m.gallery_analysis()}
                </div>
              </div>
            ) : (
              <div className="w-full max-w-[560px] rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-2xl">
                <UploadDropzone
                  instant
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
                  onFileUploaded={(file) => void prepareFile(file)}
                />
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

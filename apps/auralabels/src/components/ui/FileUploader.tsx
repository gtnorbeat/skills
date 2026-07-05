import { useState, useRef, useCallback } from "react";
import { uploadFile } from "@/utils/api";

interface FileUploaderProps {
  /** R2 folder prefix (e.g. "avatars", "artwork"). */
  folder: string;
  /** Optional entity id to scope the upload (e.g. artist id, release id). */
  entityId?: string;
  /** Called with the public URL after a successful upload. */
  onUpload: (url: string) => void;
  /** Accepted MIME types — defaults to images. */
  accept?: string;
  /** Label shown on the upload button. */
  label?: string;
  /** Show as a full-width drop zone instead of a compact button. */
  dropZone?: boolean;
  /** Called when upload starts (for parent to show saving state). */
  onUploading?: (uploading: boolean) => void;
}

/** Maximum allowed upload size — 25 MiB, synced with the server-side limit. */
const MAX_UPLOAD_SIZE = 25 * 1024 * 1024;
export function FileUploader({
  folder,
  entityId,
  onUpload,
  accept = "image/*",
  label = "Upload Image",
  dropZone = false,
  onUploading,
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);

  const startUpload = useCallback(async (file: File) => {
    // Client-side size gate — matches the server's 25 MB limit.
    if (file.size > MAX_UPLOAD_SIZE) {
      const limitMB = MAX_UPLOAD_SIZE / (1024 * 1024);
      setError(`File too large — maximum upload size is ${limitMB} MB`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setUploading(true);
    setError(null);
    onUploading?.(true);

    try {
      const result = await uploadFile(file, folder, entityId);
      onUpload(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      onUploading?.(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [folder, entityId, onUpload, onUploading]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await startUpload(file);
  }

  // ── Drag-and-drop handlers ──────────────────────────────────────

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragging(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragging(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    dragCounter.current = 0;

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    // Validate accept type client-side
    if (accept !== "*" && accept) {
      const acceptedTypes = accept.split(",").map((t) => t.trim());
      const matchesType = acceptedTypes.some((t) => {
        if (t.endsWith("/*")) {
          const category = t.slice(0, -2);
          return file.type.startsWith(category);
        }
        return file.type === t || file.name.endsWith(t.replace("*", ""));
      });
      if (!matchesType) {
        setError(`File type not accepted. Please upload ${accept}.`);
        return;
      }
    }

    await startUpload(file);
  }

  // ── Drop zone mode ──────────────────────────────────────────────

  if (dropZone) {
    return (
      <div className="space-y-1.5">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFile}
          className="hidden"
          aria-hidden="true"
        />

        <div
          ref={dropRef}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          aria-label={uploading ? `Uploading ${label.toLowerCase()}…` : `Drop ${label.toLowerCase()} here or click to browse`}
          className={`
            flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6
            transition-all duration-200
            ${dragging
              ? "border-cyan-400 bg-cyan-500/10"
              : uploading
                ? "border-zinc-600 bg-zinc-900/60"
                : error
                  ? "border-red-500/40 bg-red-500/5 hover:border-red-500/60"
                  : "border-zinc-700/50 bg-zinc-900/40 hover:border-cyan-500/30 hover:bg-zinc-900/60"
            }
            ${uploading ? "cursor-wait" : ""}
          `}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-cyan-400" />
              <p className="text-xs text-zinc-400">Uploading…</p>
            </div>
          ) : dragging ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-2xl text-cyan-400">☁</span>
              <p className="text-xs font-medium text-cyan-400">Drop to upload</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="text-2xl text-zinc-600">☁</span>
              <p className="text-xs font-medium text-zinc-400">
                Drop an image here or <span className="text-cyan-400 underline underline-offset-2">browse</span>
              </p>
              <p className="text-[10px] text-zinc-600">
                PNG, JPG, WebP, GIF — up to 25 MB
              </p>
            </div>
          )}
        </div>

        {error && (
          <p className="text-[10px] text-red-400" role="alert">{error}</p>
        )}
      </div>
    );
  }

  // ── Compact button mode (default) ───────────────────────────────

  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFile}
        className="hidden"
        aria-hidden="true"
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 py-2 text-[11px] font-medium text-zinc-300 transition-all hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {uploading ? (
          <>
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-600 border-t-cyan-400" />
            Uploading…
          </>
        ) : (
          <>
            <span aria-hidden="true" className="text-sm">☁</span>
            {label}
          </>
        )}
      </button>

      {error && (
        <p className="text-[10px] text-red-400" role="alert">{error}</p>
      )}
    </div>
  );
}

"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { estimatePageCount } from "@/lib/estimatePages";
import { compressImageFile } from "@/lib/compressImage";
import { IconArrowRight, IconUpload } from "@/components/icons";

type UploadedFile = { file: File; pages: number | null };

// Originally sized to stay under Vercel's ~4.5MB serverless request-body cap.
// Now deployed on Render (a normal persistent server, no such platform cap),
// but kept as a sane upload-size guardrail regardless of host — a document
// this large is also just slow to upload and process. Revisit if it turns
// out to be overly conservative for real classroom documents.
const SAFE_TOTAL_BYTES = 4 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function FileChipIcon({ file }: { file: File }) {
  const isPdf = isPdfFile(file);
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white ${
        isPdf ? "bg-danger" : "bg-accent"
      }`}
    >
      {isPdf ? "PDF" : "IMG"}
    </span>
  );
}

function Dropzone({
  label,
  files,
  onFilesChange,
}: {
  label: string;
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    async (incoming: FileList | null) => {
      if (!incoming || incoming.length === 0) return;
      const next = await Promise.all(
        Array.from(incoming).map(async (rawFile) => {
          // PDFs pass through untouched — only images get client-side re-encoded,
          // since PDF recompression risks corrupting/degrading the document.
          const file = isPdfFile(rawFile) ? rawFile : await compressImageFile(rawFile);
          return { file, pages: await estimatePageCount(file) };
        })
      );
      onFilesChange([...files, ...next]);
    },
    [files, onFilesChange]
  );

  const removeFile = (idx: number) => onFilesChange(files.filter((_, i) => i !== idx));

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        addFiles(e.dataTransfer.files);
      }}
      role="button"
      tabIndex={0}
      className={`relative flex min-h-[180px] flex-1 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-white p-5 text-center transition-colors ${
        isDragging ? "border-accent bg-accent-light/40" : "border-black/10 hover:border-accent/50"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {files.length === 0 ? (
        <>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/5 text-ink/60">
            <IconUpload className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-ink">
            Upload <span className="font-bold text-accent">{label}</span>
          </p>
          <p className="-mt-2 text-xs text-black/40">Max 10MB</p>
        </>
      ) : (
        <div className="flex w-full flex-col gap-2">
          {files.map((f, idx) => (
            <div
              key={`${f.file.name}-${idx}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-3 rounded-xl border border-black/5 bg-white px-3 py-2.5 text-left shadow-sm"
            >
              <FileChipIcon file={f.file} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{f.file.name}</p>
                <p className="text-xs text-black/40">
                  {formatSize(f.file.size)}
                  {f.pages ? ` • ${f.pages} Page${f.pages > 1 ? "s" : ""}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeFile(idx)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/5 text-black/50 hover:bg-black/10 hover:text-black"
                aria-label={`Remove ${f.file.name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TeacherAvatar() {
  return (
    <div className="relative mx-auto h-24 w-24">
      <div className="absolute inset-0 rounded-full bg-accent-light" />
      <div className="absolute inset-2 flex items-center justify-center rounded-full bg-accent-light text-4xl">
        🧑‍🏫
      </div>
      {[
        "top-0 left-1",
        "top-3 -right-1",
        "bottom-2 -right-2",
        "bottom-0 left-3",
        "top-1/2 -left-2",
      ].map((pos, i) => (
        <span
          key={pos}
          className={`absolute h-2 w-2 rounded-full bg-accent ring-4 ring-accent-light/60 ${pos}`}
          style={{ opacity: 0.55 + i * 0.08 }}
        />
      ))}
    </div>
  );
}

export function UploadForm({
  onSubmit,
  disabled,
}: {
  onSubmit: (questionFiles: File[], answerFiles: File[]) => void;
  disabled?: boolean;
}) {
  const [questionFiles, setQuestionFiles] = useState<UploadedFile[]>([]);
  const [answerFiles, setAnswerFiles] = useState<UploadedFile[]>([]);

  const totalBytes = useMemo(
    () => [...questionFiles, ...answerFiles].reduce((sum, f) => sum + f.file.size, 0),
    [questionFiles, answerFiles]
  );
  const overSizeLimit = totalBytes > SAFE_TOTAL_BYTES;
  const hasFiles = questionFiles.length > 0 && answerFiles.length > 0;
  const canSubmit = hasFiles && !disabled && !overSizeLimit;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-10 sm:py-14">
      <h1 className="text-center text-2xl font-extrabold text-ink sm:text-3xl">
        Upload{" "}
        <span className="rounded-lg bg-accent-light px-2 py-0.5 text-accent-dark">
          Question Paper &amp; Answer Sheets
        </span>
      </h1>
      <p className="mt-3 text-sm text-black/50">Upload both files to get started</p>

      <TeacherAvatar />

      <div className="mt-8 flex w-full flex-col gap-4 sm:flex-row">
        <Dropzone label="Question Paper" files={questionFiles} onFilesChange={setQuestionFiles} />
        <Dropzone label="Answer Sheet" files={answerFiles} onFilesChange={setAnswerFiles} />
      </div>

      <div className="mt-8 flex w-full flex-col items-center gap-2">
        <div
          className={
            hasFiles && overSizeLimit
              ? "w-full max-w-sm rounded-2xl border-2 border-dashed border-danger/50 bg-danger-light p-3"
              : canSubmit
              ? ""
              : "w-full max-w-xs rounded-2xl border-2 border-dashed border-accent/50 bg-accent-light/20 p-3"
          }
        >
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onSubmit(questionFiles.map((f) => f.file), answerFiles.map((f) => f.file))}
            className={`mx-auto flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold shadow-sm transition-colors ${
              canSubmit
                ? "bg-ink text-white hover:bg-ink-soft"
                : "w-full justify-center bg-black/10 text-black/35"
            }`}
          >
            Start Mapping
            <IconArrowRight className="h-4 w-4" />
          </button>
        </div>

        {hasFiles && overSizeLimit ? (
          <p className="max-w-sm text-center text-xs text-danger">
            Combined upload is {formatSize(totalBytes)}, which is too large to process — please use
            smaller files (max ~{formatSize(SAFE_TOTAL_BYTES)} total; images are compressed
            automatically, but PDFs aren&apos;t, so try a smaller or lower-resolution PDF).
          </p>
        ) : (
          <p className="text-center text-xs text-black/40">
            Once both files are uploaded, you&apos;ll able to map answers with questions
          </p>
        )}
      </div>
    </div>
  );
}

"use client"

import { useCallback, useState } from "react"
import type { BgMode } from "@/components/document-viewer"

const ACCEPTED_TYPES = [".docx", ".doc", ".md", ".txt", ".html", ".htm"]
const ACCEPTED_MIME = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/markdown",
  "text/plain",
  "text/html",
]

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}
function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

interface DropZoneProps {
  onFile: (file: File) => void
  bg: BgMode
  onToggleBg: () => void
}

export function DropZone({ onFile, bg, onToggleBg }: DropZoneProps) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDark = bg === "dark"
  const bgColor = isDark ? "#1e1e1e" : "#ffffff"
  const textColor = isDark ? "#d4d4d4" : "#1a1a1a"
  const mutedColor = isDark ? "#666666" : "#9ca3af"
  const borderColor = isDark ? "#2e2e2e" : "#e5e5e5"
  const dropBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)"
  const dropBgHover = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.04)"
  const dropBorderColor = dragging ? textColor : borderColor

  const validate = (file: File) => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase()
    return ACCEPTED_TYPES.includes(ext) || ACCEPTED_MIME.includes(file.type) || file.type === ""
  }

  const handle = useCallback(
    (file: File) => {
      setError(null)
      if (!validate(file)) { setError(`Unsupported file type: ${file.name}`); return }
      onFile(file)
    },
    [onFile]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault(); setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handle(file)
    },
    [handle]
  )

  return (
    <div
      className="relative flex flex-col items-center justify-center min-h-screen px-4"
      style={{ backgroundColor: bgColor }}
    >
      {/* bg toggle — top right */}
      <button
        onClick={onToggleBg}
        title={isDark ? "Switch to light" : "Switch to dark"}
        aria-label={isDark ? "Switch to light background" : "Switch to dark background"}
        className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors"
        style={{ borderColor, color: mutedColor, backgroundColor: dropBg }}
      >
        {isDark ? <SunIcon /> : <MoonIcon />}
        {isDark ? "Light" : "Dark"}
      </button>

      <div className="mb-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight mb-1" style={{ color: textColor }}>
          Doclexia
        </h1>
        <p className="text-sm" style={{ color: mutedColor }}>
          Drop a document to read it. Nothing leaves your browser.
        </p>
      </div>

      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className="relative flex flex-col items-center justify-center w-full max-w-md h-64 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-150 select-none"
        style={{
          borderColor: dropBorderColor,
          backgroundColor: dragging ? dropBgHover : dropBg,
          transform: dragging ? "scale(1.01)" : "scale(1)",
        }}
        aria-label="Drop a document or click to browse"
      >
        <input
          type="file"
          className="sr-only"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); e.target.value = "" }}
        />

        <div className="flex flex-col items-center gap-3 pointer-events-none">
          <svg
            width="40" height="40" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: dragging ? textColor : mutedColor }}
            aria-hidden="true"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: dragging ? textColor : mutedColor }}>
              {dragging ? "Release to open" : "Drop your document here"}
            </p>
            <p className="text-xs mt-0.5" style={{ color: mutedColor }}>or click to browse</p>
          </div>
        </div>
      </label>

      <p className="mt-4 text-xs" style={{ color: mutedColor }}>
        Supports .docx, .doc, .md, .txt, .html
      </p>

      {error && (
        <p className="mt-3 text-xs font-medium" style={{ color: "#ef4444" }} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

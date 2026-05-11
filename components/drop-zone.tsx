"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { BgMode } from "@/components/document-viewer"
import type { HistoryItem } from "@/lib/db"

const ACCEPTED_TYPES = [".docx", ".doc", ".md", ".txt", ".html", ".htm", ".pdf"]
const ACCEPTED_MIME = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/markdown",
  "text/plain",
  "text/html",
  "application/pdf",
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
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" /><path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

// ── Swipeable history row ──
function HistoryRow({
  item,
  isDark,
  isMobile,
  onOpen,
  onRemove,
  colors,
}: {
  item: HistoryItem
  isDark: boolean
  isMobile: boolean
  onOpen: (item: HistoryItem) => void
  onRemove: (id: string) => void
  colors: { textColor: string; mutedColor: string; borderColor: string; dropBg: string }
}) {
  const [swipeX, setSwipeX] = useState(0)
  const [removing, setRemoving] = useState(false)
  const startX = useRef(0)
  const startY = useRef(0)
  const didSwipe = useRef(false)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [holdActive, setHoldActive] = useState(false)

  // Context menu state (desktop right-click)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const ctxRef = useRef<HTMLDivElement>(null)

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return
    const close = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setCtxMenu(null)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [ctxMenu])

  const pct =
    item.totalWords > 0 && item.index >= 0
      ? Math.min(Math.round(((item.index + 1) / item.totalWords) * 100), 100)
      : 0

  const clearHold = () => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null }
  }

  // ── Touch handlers (mobile swipe + hold) ──
  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    didSwipe.current = false
    setHoldActive(false)

    holdTimer.current = setTimeout(() => {
      setHoldActive(true)
      // Light haptic if available
      try { navigator.vibrate?.(15) } catch {}
    }, 450)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current

    // Cancel hold if finger moves
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearHold()

    // Vertical scroll takes priority
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
      setSwipeX(0)
      return
    }

    // Only allow left-swipe (negative)
    if (dx < 0) {
      didSwipe.current = true
      setSwipeX(Math.max(dx, -120))
    }
  }

  const onTouchEnd = () => {
    clearHold()
    if (swipeX < -70) {
      // Swipe past threshold → delete
      setRemoving(true)
      setTimeout(() => onRemove(item.id), 250)
    } else if (!didSwipe.current && !holdActive) {
      onOpen(item)
    }
    setSwipeX(0)
    setHoldActive(false)
  }

  // ── Desktop right-click ──
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }

  const doRemove = () => {
    setCtxMenu(null)
    setRemoving(true)
    setTimeout(() => onRemove(item.id), 250)
  }

  return (
    <>
      <div
        className="relative overflow-hidden rounded-xl shrink-0 w-full"
        style={{
          opacity: removing ? 0 : 1,
          maxHeight: removing ? 0 : 80,
          marginBottom: removing ? 0 : undefined,
          transition: "opacity 250ms ease, max-height 250ms ease, margin-bottom 250ms ease, background-color 250ms ease",
        }}
      >
      {/* Red delete zone behind (visible when swiping left) */}
      <div
        className="absolute inset-0 flex items-center justify-end pr-5 rounded-xl"
        style={{ backgroundColor: "#ef4444", opacity: swipeX < 0 ? 1 : 0 }}
      >
        <TrashIcon />
      </div>

      {/* Main row content */}
      <button
        onClick={() => { if (!isMobile) onOpen(item) }}
        onContextMenu={onContextMenu}
        onTouchStart={isMobile ? onTouchStart : undefined}
        onTouchMove={isMobile ? onTouchMove : undefined}
        onTouchEnd={isMobile ? onTouchEnd : undefined}
        className="relative z-10 w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left select-none"
        style={{
          borderColor: holdActive ? colors.textColor : colors.borderColor,
          backgroundColor: "var(--card)",
          transform: `translateX(${swipeX}px)`,
          transition: swipeX === 0 
            ? "transform 200ms ease, border-color 200ms ease, background-color 250ms ease, color 250ms ease" 
            : "border-color 200ms ease, background-color 250ms ease, color 250ms ease",
          cursor: "pointer",
        }}
      >
        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-medium truncate leading-tight"
            style={{ color: colors.textColor }}
          >
            {item.name}
          </p>
          <p className="text-[11px] mt-0.5 leading-tight" style={{ color: colors.mutedColor }}>
            {pct}% read
          </p>
        </div>

        {/* Progress bar */}
        <div
          className="shrink-0 w-12 h-1 rounded-full overflow-hidden"
          style={{ 
            backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
            transition: "background-color 250ms ease"
          }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              backgroundColor: pct === 100 ? "#22c55e" : isDark ? "rgba(250,204,21,0.6)" : "rgba(250,204,21,0.8)",
              transition: "width 300ms ease, background-color 250ms ease",
            }}
          />
        </div>

        {/* Desktop: trash icon (visible on hover) */}
        {!isMobile && (
          <div
            className="shrink-0 opacity-0 group-hover-trash transition-opacity ml-1"
            onClick={(e) => { e.stopPropagation(); doRemove() }}
            title="Remove from history"
            style={{ color: colors.mutedColor }}
          >
            <TrashIcon />
          </div>
        )}
      </button>
      </div>

      {ctxMenu && createPortal(
        <div
          ref={ctxRef}
            style={{
              position: "fixed",
              left: ctxMenu.x,
              top: ctxMenu.y,
              zIndex: 9999,
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              pointerEvents: "auto",
              transition: "background-color 250ms ease, color 250ms ease, border-color 250ms ease"
            }}
          >
            <button
              onClick={doRemove}
              className="px-4 py-2 rounded-full border text-xs font-bold shadow-2xl transition-all"
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = "#ef4444"
                e.currentTarget.style.color = "#ffffff"
                e.currentTarget.style.borderColor = "#ef4444"
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = "var(--card)"
                e.currentTarget.style.color = "#ef4444"
                e.currentTarget.style.borderColor = "var(--border)"
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "7px 14px",
                fontSize: "12px",
                fontWeight: 500,
                color: "#ef4444",
                backgroundColor: "var(--card)",
                border: `1px solid var(--border)`,
                borderRadius: "10px",
                cursor: "pointer",
                whiteSpace: "nowrap",
                boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
                transition: "all 120ms ease, background-color 250ms ease, border-color 250ms ease, color 250ms ease"
              }}
          >
            <TrashIcon /> Remove
          </button>
        </div>,
        document.body
      )}
    </>
  )
}

// ── Main DropZone ──
interface DropZoneProps {
  onFile: (file: File) => void
  bg: BgMode
  onToggleBg: () => void
  history?: HistoryItem[]
  onHistoryOpen?: (item: HistoryItem) => void
  onHistoryRemove?: (id: string) => void
}

export function DropZone({ onFile, bg, onToggleBg, history = [], onHistoryOpen, onHistoryRemove }: DropZoneProps) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const historyScrollRef = useRef<HTMLDivElement>(null)
  const [showTopMask, setShowTopMask] = useState(false)
  const [showBottomMask, setShowBottomMask] = useState(false)

  const checkScroll = useCallback(() => {
    const el = historyScrollRef.current
    if (!el) return
    setShowTopMask(el.scrollTop > 10)
    setShowBottomMask(el.scrollHeight - el.scrollTop - el.clientHeight > 10)
  }, [])

  useEffect(() => {
    setIsMobile("ontouchstart" in window || navigator.maxTouchPoints > 0)
    // Initial check after mount/render
    setTimeout(checkScroll, 100)
  }, [checkScroll, history.length])

  useEffect(() => {
    const el = historyScrollRef.current
    if (!el) return
    el.addEventListener("scroll", checkScroll)
    window.addEventListener("resize", checkScroll)
    return () => {
      el.removeEventListener("scroll", checkScroll)
      window.removeEventListener("resize", checkScroll)
    }
  }, [checkScroll])

  const isDark = bg === "dark"
  const bgColor = "var(--background)"
  const textColor = "var(--foreground)"
  const mutedColor = "var(--muted-foreground)"
  const borderColor = "var(--border)"
  const dropBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)"
  const dropBgHover = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.04)"
  const dropBorderColor = dragging ? textColor : borderColor

  const colors = { textColor, mutedColor, borderColor, dropBg }

  const validate = (file: File) => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase()
    return ACCEPTED_TYPES.includes(ext) || ACCEPTED_MIME.includes(file.type) || file.type === ""
  }

  const handle = useCallback(
    (file: File) => {
      setError(null)
      if (!validate(file)) { 
        setError(`Unsupported file type: ${file.name}. If you'd like to see this format supported, feel free to reach out and request it!`)
        return 
      }
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
          Doc<span style={{ color: "#B3951E" }}>lexia</span>
        </h1>
        <p className="text-sm" style={{ color: mutedColor }}>
          Never lose track of where you are in a document.
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
        Supports .pdf, .docx, .doc, .md, .txt, .html
      </p>

      {error && (
        <p className="mt-3 text-xs font-medium" style={{ color: "#ef4444" }} role="alert">
          {error}
        </p>
      )}

      {/* ── Recent Documents ── */}
      {history.length > 0 && onHistoryOpen && onHistoryRemove && (
        <div className="mt-12 w-full max-w-md animate-fadeIn">
          <h2
            className="text-sm mb-3 px-1"
            style={{ color: mutedColor }}
          >
            Recent
          </h2>

          <div className="relative group/history">
            {/* Top Fade Mask */}
            <div 
              className="absolute top-0 left-0 right-0 h-8 z-20 pointer-events-none transition-opacity duration-300"
              style={{ 
                opacity: showTopMask ? 1 : 0,
                backgroundColor: bgColor,
                WebkitMaskImage: "linear-gradient(to bottom, black, transparent)",
                maskImage: "linear-gradient(to bottom, black, transparent)",
                transition: "opacity 300ms ease, background-color 250ms ease"
              }}
            />
            
            <div 
              ref={historyScrollRef}
              className="flex flex-col gap-2 history-list overflow-y-auto max-h-[340px] pr-1 scrollbar-hide"
              style={{ scrollBehavior: "smooth" }}
            >
              {history.map((item) => (
                <HistoryRow
                  key={item.id}
                  item={item}
                  isDark={isDark}
                  isMobile={isMobile}
                  onOpen={onHistoryOpen}
                  onRemove={onHistoryRemove}
                  colors={colors}
                />
              ))}
            </div>

            {/* Bottom Fade Mask */}
            <div 
              className="absolute bottom-0 left-0 right-0 h-8 z-20 pointer-events-none transition-opacity duration-300"
              style={{ 
                opacity: showBottomMask ? 1 : 0,
                backgroundColor: bgColor,
                WebkitMaskImage: "linear-gradient(to top, black, transparent)",
                maskImage: "linear-gradient(to top, black, transparent)",
                transition: "opacity 300ms ease, background-color 250ms ease"
              }}
            />
          </div>

          {/* Mobile-only tip */}
          {isMobile && (
            <p
              className="text-[10px] mt-3 text-center italic opacity-60"
              style={{ color: mutedColor }}
            >
              swipe left to remove
            </p>
          )}
        </div>
      )}

      <footer className="absolute bottom-6 left-0 right-0 text-center flex flex-col gap-1 opacity-40 select-none">
        <p className="text-[10px] italic" style={{ color: mutedColor }}>
          made by skyade w/ coffee
        </p>
        <p className="text-[10px] italic" style={{ color: mutedColor }}>
          enjoy knowing where you are, or left off
        </p>
      </footer>

      {/* Scoped styles for hover trash + fadeIn animation */}
      <style jsx global>{`
        .history-list button:hover .group-hover-trash {
          opacity: 1 !important;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: none; }
        }
        .animate-fadeIn {
          animation: fadeIn 300ms ease both;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"
import rehypeRaw from "rehype-raw"

type DocType = "docx" | "markdown" | "html" | "text"

export type BgMode = "light" | "dark"



interface DocumentViewerProps {
  file: File
  onClose: () => void
  bg: BgMode
  onToggleBg: () => void
}

function detectType(file: File): DocType {
  const ext = file.name.split(".").pop()?.toLowerCase()
  if (ext === "docx" || ext === "doc") return "docx"
  if (ext === "md" || ext === "markdown") return "markdown"
  if (ext === "html" || ext === "htm") return "html"
  return "text"
}



// Walk all text nodes and replace each word with a <span class="doc-word" data-word="N">
function wrapWordsInRoot(root: HTMLElement): number {
  let idx = 0

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? ""
      if (!text.trim()) return
      const frag = document.createDocumentFragment()
      const tokens = text.split(/(\s+)/)
      for (const token of tokens) {
        if (!token) continue
        if (/^\s+$/.test(token)) {
          frag.appendChild(document.createTextNode(token))
        } else {
          const span = document.createElement("span")
          span.className = "doc-word"
          span.dataset.word = String(idx++)
          span.textContent = token
          frag.appendChild(span)
        }
      }
      node.parentNode?.replaceChild(frag, node)
    } else if (
      node.nodeType === Node.ELEMENT_NODE &&
      !(node as HTMLElement).dataset.word
    ) {
      Array.from(node.childNodes).forEach(walk)
    }
  }

  walk(root)
  return idx
}

// ---------- icons ----------
function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}
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



// How long (ms) to hold before auto-repeat begins (Space or Backspace)
const HOLD_INITIAL_DELAY = 320
// Interval (ms) between words when holding
const HOLD_REPEAT_MS = 90
// How long (ms) to hold Backspace *past* the initial delay to trigger a full clear
const BKSP_CLEAR_DURATION = 1200

export function DocumentViewer({ file, onClose, bg, onToggleBg }: DocumentViewerProps) {
  const [rawHtml, setRawHtml] = useState("")
  const [type, setType] = useState<DocType>("text")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Word-highlight state
  const [readIndex, setReadIndex] = useState(-1)
  const [totalWords, setTotalWords] = useState(0)

  // Backspace hold-to-clear state
  const [bkspProgress, setBkspProgress] = useState(0) // 0–100

  // Separate stable container ref (never re-mounted by React)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const stableRef = useRef<HTMLDivElement | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Mutable refs so key handlers always see fresh values without re-binding
  const readIndexRef = useRef(-1)
  const totalWordsRef = useRef(0)
  const spaceHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const spaceRepeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Backspace: phase 1 = single step-back, phase 2 = hold-to-clear fill bar
  const bkspHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bkspStartRef = useRef<number | null>(null)
  const bkspRafRef = useRef<number | null>(null)

  const isDark = bg === "dark"
  const bgColor     = isDark ? "#1e1e1e" : "#ffffff"
  const textColor   = isDark ? "#d4d4d4" : "#1a1a1a"
  const borderColor = isDark ? "#2e2e2e" : "#e5e5e5"
  const mutedColor  = isDark ? "#666666" : "#9ca3af"
  const headerBg    = isDark ? "rgba(30,30,30,0.9)" : "rgba(255,255,255,0.9)"
  const hlColor     = isDark ? "rgba(250,204,21,0.30)" : "rgba(250,204,21,0.50)"

  // ---- load file ----
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setRawHtml("")
    setReadIndex(-1)
    setTotalWords(0)
    readIndexRef.current = -1
    totalWordsRef.current = 0

    const docType = detectType(file)
    setType(docType)

    async function load() {
      try {
        if (docType === "docx") {
          const mammoth = await import("mammoth")
          const arrayBuffer = await file.arrayBuffer()
          const result = await mammoth.convertToHtml(
            { arrayBuffer },
            {
              styleMap: [
                "b => strong",
                "i => em",
                "u => u",
                "strike => s",
                "p[style-name='Heading 1'] => h1:fresh",
                "p[style-name='Heading 2'] => h2:fresh",
                "p[style-name='Heading 3'] => h3:fresh",
                "p[style-name='Heading 4'] => h4:fresh",
                "p[style-name='Heading 5'] => h5:fresh",
                "p[style-name='Heading 6'] => h6:fresh",
                "p[style-name='Title'] => h1.doc-title:fresh",
                "p[style-name='Subtitle'] => p.doc-subtitle:fresh",
              ],
              includeEmbeddedStyleMap: true,
              includeDefaultStyleMap: true,
            }
          )
          if (!cancelled) setRawHtml(result.value)
        } else {
          const text = await file.text()
          if (!cancelled) setRawHtml(text)
        }
      } catch (err) {
        if (!cancelled)
          setError("Failed to parse document. " + (err instanceof Error ? err.message : String(err)))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [file])

  // ---- build / rebuild the stable inner DOM ----
  const buildContent = useCallback(() => {
    const wrapper = wrapperRef.current
    if (!wrapper || loading || error) return

    if (stableRef.current) stableRef.current.remove()

    const div = document.createElement("div")
    wrapper.appendChild(div)
    stableRef.current = div

    if (type === "docx") {
      div.innerHTML = rawHtml
      div.className = "doc-content prose-doc"
    } else if (type === "text") {
      const pre = document.createElement("pre")
      pre.className = "whitespace-pre-wrap break-words font-mono text-sm leading-relaxed"
      pre.textContent = rawHtml
      div.appendChild(pre)
    } else {
      return
    }

    const count = wrapWordsInRoot(div)
    setTotalWords(count)
    totalWordsRef.current = count
    // NOTE: We no longer reset readIndex here to preserve progress on setting toggles
  }, [loading, error, type, rawHtml])

  useEffect(() => {
    if (type === "html" && !loading && rawHtml && iframeRef.current) {
      const doc = iframeRef.current.contentDocument
      if (!doc) return
      const themed = isDark
        ? `<style>html,body{background:#1e1e1e!important;color:#d4d4d4!important;font-family:inherit;}</style>${rawHtml}`
        : rawHtml
      doc.open(); doc.write(themed); doc.close()
    }
  }, [type, loading, rawHtml, isDark])

  useEffect(() => {
    if (type !== "html" && type !== "markdown") buildContent()
  }, [buildContent, type])

  // ---- apply / remove highlight colour imperatively ----
  const applyHighlight = useCallback((upToIndex: number) => {
    const root = stableRef.current ?? wrapperRef.current
    if (!root) return
    
    // Performance optimization: only touch spans that actually need a change
    // If it's a small document, full scan is fine, but for large ones we focus on the range
    const spans = root.querySelectorAll<HTMLSpanElement>(".doc-word[data-word]")
    spans.forEach((span) => {
      const i = Number(span.dataset.word)
      const shouldBeHighlighted = i <= upToIndex
      const isCurrentlyHighlighted = span.style.backgroundColor !== ""
      
      if (shouldBeHighlighted !== isCurrentlyHighlighted) {
        span.style.backgroundColor = shouldBeHighlighted ? hlColor : ""
        span.style.borderRadius = shouldBeHighlighted ? "2px" : ""
      }

      // Auto-scroll the active word into view
      if (i === upToIndex) {
        span.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    })
  }, [hlColor])

  useEffect(() => { applyHighlight(readIndex) }, [readIndex, applyHighlight])

  // ---- Space: advance one word per keydown, hold to repeat after initial delay ----
  const stopSpace = useCallback(() => {
    if (spaceHoldTimerRef.current) { clearTimeout(spaceHoldTimerRef.current); spaceHoldTimerRef.current = null }
    if (spaceRepeatRef.current) { clearInterval(spaceRepeatRef.current); spaceRepeatRef.current = null }
  }, [])

  const advanceOne = useCallback(() => {
    const next = readIndexRef.current + 1
    if (next >= totalWordsRef.current) return
    readIndexRef.current = next
    setReadIndex(next)
  }, [])

  const startSpace = useCallback(() => {
    // Advance exactly once immediately on press
    advanceOne()
    // After the initial delay, start the repeat interval
    spaceHoldTimerRef.current = setTimeout(() => {
      spaceRepeatRef.current = setInterval(advanceOne, HOLD_REPEAT_MS)
    }, HOLD_INITIAL_DELAY)
  }, [advanceOne])

  // ---- Backspace: step back one word, hold to repeat, hold longer to clear ----
  const stopBksp = useCallback(() => {
    if (bkspHoldTimerRef.current) { clearTimeout(bkspHoldTimerRef.current); bkspHoldTimerRef.current = null }
    if (bkspRafRef.current) { cancelAnimationFrame(bkspRafRef.current); bkspRafRef.current = null }
    bkspStartRef.current = null
    setBkspProgress(0)
  }, [])

  const retreatOne = useCallback(() => {
    const prev = readIndexRef.current - 1
    if (prev < -1) return
    readIndexRef.current = prev
    setReadIndex(prev)
  }, [])

  const startBksp = useCallback(() => {
    // Phase 1: step back exactly once on press
    retreatOne()

    // Phase 2: after the same initial delay as Space, switch into "hold-to-clear" mode.
    // We stop any further stepping and instead show the fill bar.
    // Releasing before the bar fills cancels with no effect.
    bkspHoldTimerRef.current = setTimeout(() => {
      // Begin fill animation
      bkspStartRef.current = performance.now()

      const tick = () => {
        if (bkspStartRef.current === null) return
        const elapsed = performance.now() - bkspStartRef.current
        const pct = Math.min((elapsed / BKSP_CLEAR_DURATION) * 100, 100)
        setBkspProgress(pct)
        if (pct < 100) {
          bkspRafRef.current = requestAnimationFrame(tick)
        } else {
          // Bar filled — clear everything
          readIndexRef.current = -1
          setReadIndex(-1)
          bkspStartRef.current = null
          setBkspProgress(0)
        }
      }
      bkspRafRef.current = requestAnimationFrame(tick)
    }, HOLD_INITIAL_DELAY)
  }, [retreatOne])

  // ---- keyboard listeners ----
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.code === "Space") {
        e.preventDefault()
        if (e.repeat) return   // browser-level key repeat — we manage our own
        startSpace()
      }

      if (e.code === "Backspace") {
        e.preventDefault()
        if (e.repeat) return
        startBksp()
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") {
        stopSpace()
      }
      if (e.code === "Backspace") {
        stopBksp()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      stopSpace()
      stopBksp()
    }
  }, [startSpace, stopSpace, startBksp, stopBksp])


  const ext = file.name.split(".").pop()?.toUpperCase() ?? "DOC"
  const sizeKb = (file.size / 1024).toFixed(0)
  const progressPct = totalWords > 0 ? Math.round(((readIndex + 1) / totalWords) * 100) : 0

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {/* ---- Header ---- */}
      <header
        className="sticky top-0 z-10 border-b backdrop-blur-sm"
        style={{ borderColor, backgroundColor: headerBg }}
      >
        <div className="max-w-3xl mx-auto px-4 h-12 flex items-center gap-3">
          <button
            onClick={onClose}
            aria-label="Close document"
            className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
            style={{ color: mutedColor }}
          >
            <ArrowLeftIcon />
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate leading-tight">{file.name}</p>
            <p className="text-xs leading-tight" style={{ color: mutedColor }}>
              {ext} &middot; {sizeKb} KB
              {totalWords > 0 && readIndex >= 0 && <span> &middot; {progressPct}% read</span>}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0 flex-wrap">
            <button
              onClick={onToggleBg}
              title={isDark ? "Switch to light" : "Switch to dark"}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors"
              style={{ borderColor, color: mutedColor }}
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
              {isDark ? "Light" : "Dark"}
            </button>

          </div>
        </div>

        {/* read-progress bar */}
        {totalWords > 0 && (
          <div className="h-0.5 w-full" style={{ backgroundColor: borderColor }}>
            <div
              className="h-full transition-all duration-75"
              style={{
                width: `${progressPct}%`,
                backgroundColor: "rgba(250,204,21,0.65)",
              }}
            />
          </div>
        )}
      </header>

      {/* ---- Hint bar — always visible when document is loaded ---- */}
      {!loading && !error && type !== "html" && totalWords > 0 && (
        <div
          className="flex items-center justify-center gap-2 text-xs py-2 select-none"
          style={{ color: mutedColor, borderBottom: `1px solid ${borderColor}` }}
        >
          {/* Backspace clear progress indicator */}
          {bkspProgress > 0 && (
            <span
              className="inline-block rounded-sm overflow-hidden"
              style={{ width: 32, height: 4, backgroundColor: borderColor }}
              aria-hidden="true"
            >
              <span
                className="block h-full rounded-sm"
                style={{
                  width: `${bkspProgress}%`,
                  backgroundColor: "rgba(239,68,68,0.7)",
                  // Removed the conflicting CSS transition so requestAnimationFrame can run smoothly
                }}
              />
            </span>
          )}
          <kbd
            className="px-1.5 py-0.5 rounded text-xs font-mono border"
            style={{ borderColor, color: mutedColor, backgroundColor: "transparent" }}
          >
            Space
          </kbd>
          <span>to advance</span>
          <span style={{ color: borderColor }}>·</span>
          <kbd
            className="px-1.5 py-0.5 rounded text-xs font-mono border"
            style={{ borderColor, color: mutedColor, backgroundColor: "transparent" }}
          >
            Backspace
          </kbd>
          <span>to step back</span>
          <span style={{ color: borderColor }}>·</span>
          <span>hold to clear</span>
        </div>
      )}

      {/* ---- Main content ---- */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-10">
        {loading && (
          <div className="flex items-center justify-center h-40">
            <div
              className="w-5 h-5 rounded-full border-2 animate-spin"
              style={{ borderColor, borderTopColor: textColor }}
              aria-label="Loading"
            />
          </div>
        )}

        {error && (
          <div
            className="rounded-xl border px-5 py-4 text-sm"
            style={{ borderColor: "#f87171", backgroundColor: "rgba(239,68,68,0.08)", color: "#ef4444" }}
            role="alert"
          >
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {(type === "docx" || type === "text") && (
              <div
                ref={wrapperRef}
                style={{ color: textColor }}
              />
            )}

            {type === "markdown" && (
              <MarkdownContent
                source={rawHtml}
                textColor={textColor}
                hlColor={hlColor}
                onWrapped={(count) => {
                  setTotalWords(count)
                  totalWordsRef.current = count
                  // Progress is preserved via the readIndex prop
                }}
                readIndex={readIndex}
              />
            )}

            {type === "html" && (
              <iframe
                ref={iframeRef}
                title="HTML document"
                className="w-full min-h-[80vh] rounded-xl border"
                style={{ borderColor, backgroundColor: bgColor }}
                sandbox="allow-same-origin"
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}

// ---- Markdown sub-component ----
interface MarkdownContentProps {
  source: string
  textColor: string
  hlColor: string
  readIndex: number
  onWrapped: (count: number) => void
}

function MarkdownContent({ source, textColor, hlColor, readIndex, onWrapped }: MarkdownContentProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Remove previous wrapping
    el.querySelectorAll<HTMLSpanElement>(".doc-word").forEach((s) => {
      s.replaceWith(document.createTextNode(s.textContent ?? ""))
    })
    el.normalize()
    const count = wrapWordsInRoot(el)
    onWrapped(count)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.querySelectorAll<HTMLSpanElement>(".doc-word[data-word]").forEach((span) => {
      const i = Number(span.dataset.word)
      const shouldBeHighlighted = i <= readIndex
      const isCurrentlyHighlighted = span.style.backgroundColor !== ""

      if (shouldBeHighlighted !== isCurrentlyHighlighted) {
        span.style.backgroundColor = shouldBeHighlighted ? hlColor : ""
        span.style.borderRadius = shouldBeHighlighted ? "2px" : ""
      }

      if (i === readIndex) {
        span.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    })
  }, [readIndex, hlColor])

  return (
    <div
      ref={ref}
      className="prose-doc"
      style={{ color: textColor }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} rehypePlugins={[rehypeRaw]}>
        {source}
      </ReactMarkdown>
    </div>
  )
}

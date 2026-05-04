"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"
import rehypeRaw from "rehype-raw"
import { usePinchToResize } from "@/hooks/use-pinch-to-resize"

type DocType = "docx" | "markdown" | "html" | "text" | "pdf"
export type BgMode = "light" | "dark"

type FontChoice = "default" | "lexend" | "opendyslexic" | "lora"
type ReadMode = "word" | "letter"

interface ReaderSettings {
  font: FontChoice
  speedMs: number
  readMode: ReadMode
  skipHeadings: boolean
  fontSize: number
  pinchToScale: boolean
}

const FONT_FAMILIES: Record<FontChoice, string> = {
  default:      "var(--font-sans), system-ui, sans-serif",
  lexend:       "'Lexend', sans-serif",
  lora:         "'Lora', serif",
  opendyslexic: "'OpenDyslexic', sans-serif",
}

const FONT_LABELS: Record<FontChoice, string> = {
  default:      "Default (Geist)",
  lexend:       "Lexend (Sans)",
  lora:         "Lora (Serif)",
  opendyslexic: "OpenDyslexic",
}

const SPEED_PRESETS = [
  { label: "Slow", value: 200 },
  { label: "Medium", value: 90 },
  { label: "Fast", value: 45 },
]

const LS_SETTINGS_KEY = "docviewer-settings"
const HEADING_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6"])
const MAX_FILE_SIZE_KB = 500 // 500KB limit to prevent browser crashes with millions of spans

function loadSettings(): ReaderSettings {
  try {
    const raw = localStorage.getItem(LS_SETTINGS_KEY)
    if (raw) return { font: "default", speedMs: 90, readMode: "word", skipHeadings: true, fontSize: 18, pinchToScale: true, ...JSON.parse(raw) }
  } catch {}
  return { font: "default", speedMs: 90, readMode: "word", skipHeadings: true, fontSize: 18, pinchToScale: true }
}

function saveSettings(s: ReaderSettings) {
  try { localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(s)) } catch {}
}

interface DocumentViewerProps {
  file: File
  onClose: () => void
  bg: BgMode
  onToggleBg: () => void
  initialIndex?: number
  onIndexChange?: (index: number) => void
}

async function detectType(file: File): Promise<DocType> {
  // Read first 4 bytes to check magic numbers (signatures)
  const buffer = await file.slice(0, 4).arrayBuffer()
  const bytes = new Uint8Array(buffer)
  
  // PDF: %PDF (0x25 0x50 0x44 0x46)
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "pdf"
  
  // DOCX/ZIP: PK\x03\x04 (0x50 0x4B 0x03 0x04)
  if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) return "docx"

  const ext = file.name.split(".").pop()?.toLowerCase()
  if (ext === "pdf") return "pdf"
  if (ext === "docx" || ext === "doc") return "docx"
  if (ext === "md" || ext === "markdown") return "markdown"
  if (ext === "html" || ext === "htm") return "html"
  return "text"
}

function wrapWordsInRoot(root: HTMLElement, mode: ReadMode): number {
  let idx = 0

  function isInsideHeading(node: Node): boolean {
    let cur: Node | null = node.parentNode
    while (cur && cur !== root) {
      if (cur.nodeType === Node.ELEMENT_NODE && HEADING_TAGS.has((cur as HTMLElement).tagName)) return true
      cur = cur.parentNode
    }
    return false
  }

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? ""
      if (!text.trim()) return
      const inHeading = isInsideHeading(node)
      const frag = document.createDocumentFragment()
      const tokens = text.split(/(\s+)/)
      
      for (const token of tokens) {
        if (!token) continue
        if (/^\s+$/.test(token)) {
          frag.appendChild(document.createTextNode(token))
        } else {
          if (mode === "word") {
            const span = document.createElement("span")
            span.className = "doc-word"
            span.dataset.word = String(idx++)
            if (inHeading) span.dataset.inHeading = "true"
            span.textContent = token
            frag.appendChild(span)
          } else {
            // letter mode
            for (const char of token) {
              const span = document.createElement("span")
              span.className = "doc-word"
              span.dataset.word = String(idx++)
              if (inHeading) span.dataset.inHeading = "true"
              span.textContent = char
              frag.appendChild(span)
            }
          }
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
function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

// Traces a smooth progress line around the 4 edges of a button using CSS conic-gradient and masks
function BorderTrace({ progress }: { progress: number }) {
  const p = Math.max(0, Math.min(100, progress))
  return (
    <div 
      className="absolute inset-0 pointer-events-none" 
      style={{
        borderRadius: "16px",
        padding: "3px", // Outline stroke width
        // Conic gradient fills up like a pie chart
        background: `conic-gradient(from 0deg at 50% 50%, rgba(239,68,68,0.9) ${p}%, transparent 0)`,
        // Two masks: one for the content box (hollow center), one for the full border box.
        // XOR composite means "only show the background where the masks DO NOT overlap" (i.e. only the padding area)
        WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
        WebkitMaskComposite: "xor",
        maskComposite: "exclude",
      }}
    />
  )
}

const HOLD_INITIAL_DELAY = 320
const BKSP_CLEAR_DURATION = 1200

export function DocumentViewer({ file, onClose, bg, onToggleBg, initialIndex = -1, onIndexChange }: DocumentViewerProps) {
  const [rawHtml, setRawHtml] = useState("")
  const [type, setType] = useState<DocType>("text")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [settings, setSettings] = useState<ReaderSettings>(() => loadSettings())
  const speedRef = useRef(settings.speedMs)
  const skipRef = useRef(settings.skipHeadings)

  // Custom Pinch-to-Resize logic for mobile
  usePinchToResize(useCallback((delta: number) => {
    if (!settings.pinchToScale) return
    setSettings(prev => {
      const nextSize = Math.min(Math.max(prev.fontSize + delta, 12), 48)
      if (nextSize === prev.fontSize) return prev
      const next = { ...prev, fontSize: nextSize }
      saveSettings(next)
      return next
    })
  }, [settings.pinchToScale]))

  useEffect(() => {
    speedRef.current = settings.speedMs
    skipRef.current = settings.skipHeadings
  }, [settings.speedMs, settings.skipHeadings])
  
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Click outside to close menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuOpen && menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [menuOpen])

  // Redundant effect removed to avoid confusion

  const updateSettings = (patch: Partial<ReaderSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      if (patch.speedMs !== undefined) speedRef.current = patch.speedMs
      if (patch.skipHeadings !== undefined) skipRef.current = patch.skipHeadings
      saveSettings(next)
      return next
    })
  }

  const [readIndex, setReadIndex] = useState(initialIndex)
  const [totalWords, setTotalWords] = useState(0)
  const [bkspProgress, setBkspProgress] = useState(0)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const stableRef = useRef<HTMLDivElement | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const wordSpanMapRef = useRef<Map<number, HTMLSpanElement>>(new Map())

  const readIndexRef = useRef(initialIndex)
  const isFirstBuildRef = useRef(true)

  useEffect(() => {
    if (onIndexChange) onIndexChange(readIndex)
  }, [readIndex, onIndexChange])
  const totalWordsRef = useRef(0)
  const spaceHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const spaceRepeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
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

    if (file.size > MAX_FILE_SIZE_KB * 1024) {
      setError(`File is too large (${(file.size/1024).toFixed(0)}KB). Please use files under ${MAX_FILE_SIZE_KB}KB to prevent browser performance issues.`)
      setLoading(false)
      return
    }

    async function load() {
      try {
        const docType = await detectType(file)
        setType(docType)
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
        } else if (docType === "pdf") {
          console.log("[Doclexia] Initializing PDF engine...")
          // Robust import: handle both ESM and CommonJS/Bundler wrappers
          const pdfModule = await import("pdfjs-dist/legacy/build/pdf.mjs")
          const pdfjsLib = pdfModule.getDocument ? pdfModule : (pdfModule as any).default
          
          if (!pdfjsLib || !pdfjsLib.getDocument) {
            console.error("[Doclexia] PDF engine module invalid:", pdfModule)
            throw new Error("PDF engine failed to load properly. Please try refreshing.")
          }

          // Lock worker version and use a more reliable fallback path
          const pdfVersion = pdfjsLib.version || "5.7.284"
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfVersion}/legacy/build/pdf.worker.mjs`
          
          console.log(`[Doclexia] Fetching PDF buffer...`)
          const buffer = await file.arrayBuffer()
          const loadingTask = pdfjsLib.getDocument({ data: buffer })
          const pdf = await loadingTask.promise
          
          console.log(`[Doclexia] PDF opened successfully: ${pdf.numPages} pages`)
          let fullHtml = ""
          let currentLineItems: any[] = []
          let lastY: number | null = null
          
          function flushLine() {
            if (currentLineItems.length === 0) return
            const lineText = currentLineItems.map(it => it.str).join(" ").trim()
            if (!lineText) { currentLineItems = []; return }
            
            // Heuristic: If font height is significantly larger than base text, it's a header
            // Most PDF text is 9-11pt. 13pt+ is usually a header.
            const maxHeight = Math.max(...currentLineItems.map(it => it.height || 0))
            const isBold = currentLineItems.some(it => (it.fontName || "").toLowerCase().includes("bold"))
            
            if (maxHeight > 13 || (maxHeight > 11 && isBold)) {
              fullHtml += `<h2 class="doc-pdf-header">${lineText}</h2>`
            } else {
              fullHtml += `<p>${lineText}</p>`
            }
            currentLineItems = []
          }

          for (let i = 1; i <= pdf.numPages; i++) {
            console.log(`[Doclexia] Extracting page ${i}...`)
            const page = await pdf.getPage(i)
            const textContent = await page.getTextContent()
            
            for (const item of textContent.items as any[]) {
              if (typeof item.str !== "string") continue
              
              const y = item.transform[5]
              
              if (lastY !== null && Math.abs(lastY - y) > 5) {
                flushLine()
              }
              
              currentLineItems.push(item)
              lastY = y
            }
            flushLine() // End of page
            lastY = null
          }
          pdf.destroy() 
          
          if (!fullHtml.trim()) {
            throw new Error("No readable text found in this PDF. It might be a scanned document or image-only file.")
          }

          if (!cancelled) setRawHtml(fullHtml)
        } else {
          const text = await file.text()
          if (!cancelled) setRawHtml(text)
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err)
          if (msg.includes("is this a zip file")) {
            const text = await file.text()
            // If the file contains null bytes in the first chunk, it's definitely binary
            if (text.slice(0, 2000).indexOf('\0') !== -1) {
              setError("This appears to be an older Word format (.doc) or a binary file renamed to .docx. Doclexia only supports modern .docx, .pdf, or .txt files.")
            } else {
              setType("text")
              setRawHtml(text)
            }
          } else {
            setError("Failed to parse document. " + msg)
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [file])

  // ---- apply / remove highlight colour imperatively ----
  const applyHighlight = useCallback((upToIndex: number, shouldScroll: boolean) => {
    const map = wordSpanMapRef.current
    if (!map.size) {
      const root = stableRef.current ?? wrapperRef.current
      if (!root) return
      root.querySelectorAll<HTMLSpanElement>(".doc-word[data-word]").forEach((span) => {
        const i = Number(span.dataset.word)
        const shouldBe = i <= upToIndex
        const isCurrent = span.style.backgroundColor !== ""
        if (shouldBe !== isCurrent) {
          span.style.backgroundColor = shouldBe ? hlColor : ""
          span.style.borderRadius = shouldBe ? "2px" : ""
        }
        if (shouldScroll && i === upToIndex) span.scrollIntoView({ behavior: "smooth", block: "center" })
      })
      return
    }
    map.forEach((span, i) => {
      const shouldBe = i <= upToIndex
      const isCurrent = span.style.backgroundColor !== ""
      if (shouldBe !== isCurrent) {
        span.style.backgroundColor = shouldBe ? hlColor : ""
        span.style.borderRadius = shouldBe ? "2px" : ""
      }
      if (shouldScroll && i === upToIndex) span.scrollIntoView({ behavior: "smooth", block: "center" })
    })
  }, [hlColor])

  // ---- build / rebuild the stable inner DOM ----
  const buildContent = useCallback(() => {
    const wrapper = wrapperRef.current
    if (!wrapper || loading || error) return

    if (stableRef.current) stableRef.current.remove()

    const div = document.createElement("div")
    wrapper.appendChild(div)
    stableRef.current = div

    if (type === "docx" || type === "pdf") {
      div.innerHTML = rawHtml
      div.className = "doc-content prose-doc"
    } else if (type === "text") {
      const pre = document.createElement("pre")
      pre.className = "whitespace-pre-wrap break-words text-sm leading-relaxed"
      pre.textContent = rawHtml
      div.appendChild(pre)
    } else {
      return
    }

    const count = wrapWordsInRoot(div, settings.readMode)
    const map = new Map<number, HTMLSpanElement>()
    div.querySelectorAll<HTMLSpanElement>(".doc-word[data-word]").forEach(span => {
      map.set(Number(span.dataset.word), span)
    })
    wordSpanMapRef.current = map
    setTotalWords(count)
    totalWordsRef.current = count

    // If this is the first build, restore the initial index from cache
    if (isFirstBuildRef.current) {
      setReadIndex(initialIndex)
      readIndexRef.current = initialIndex
      // Ensure we highlight and scroll to the position once the DOM is ready
      setTimeout(() => applyHighlight(initialIndex, true), 50)
      isFirstBuildRef.current = false
    }
  }, [loading, error, type, rawHtml, settings.readMode, initialIndex, applyHighlight])

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



  // Call on render, but DO NOT auto-scroll (prevents scrolling on theme toggle)
  useEffect(() => { applyHighlight(readIndex, false) }, [readIndex, applyHighlight])

  // ---- Space: advance one word, skipping heading words ----
  const stopSpace = useCallback(() => {
    if (spaceHoldTimerRef.current) { clearTimeout(spaceHoldTimerRef.current); spaceHoldTimerRef.current = null }
    if (spaceRepeatRef.current) { clearInterval(spaceRepeatRef.current); spaceRepeatRef.current = null }
  }, [])

  const advanceOne = useCallback(() => {
    let next = readIndexRef.current + 1
    if (next >= totalWordsRef.current) return

    if (skipRef.current) {
      const map = wordSpanMapRef.current
      while (next < totalWordsRef.current) {
        const span = map.get(next)
        if (!span || span.dataset.inHeading !== "true") break
        next++
      }
      if (next >= totalWordsRef.current) return
    }

    readIndexRef.current = next
    setReadIndex(next)
    applyHighlight(next, true) // Explicitly scroll when advancing
  }, [applyHighlight])

  // ---- Backspace: step back one word, hold to clear ----
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
    applyHighlight(prev, true) // Explicitly scroll when retreating
  }, [applyHighlight])

  const startBksp = useCallback(() => {
    // Clear any accidental text selection on Android
    window.getSelection()?.removeAllRanges()
    
    retreatOne()
    bkspHoldTimerRef.current = setTimeout(() => {
      bkspStartRef.current = performance.now()
      const tick = () => {
        if (bkspStartRef.current === null) return
        const elapsed = performance.now() - bkspStartRef.current
        const pct = Math.min((elapsed / BKSP_CLEAR_DURATION) * 100, 100)
        setBkspProgress(pct)
        if (pct < 100) {
          bkspRafRef.current = requestAnimationFrame(tick)
        } else {
          readIndexRef.current = -1
          setReadIndex(-1)
          bkspStartRef.current = null
          setBkspProgress(0)
        }
      }
      bkspRafRef.current = requestAnimationFrame(tick)
    }, HOLD_INITIAL_DELAY)
  }, [retreatOne])

  // ---- Cleanup all timers on unmount to prevent leaks ----
  useEffect(() => {
    return () => {
      stopSpace()
      stopBksp()
    }
  }, [stopSpace, stopBksp])

  const startSpace = useCallback(() => {
    // Clear any accidental text selection on Android
    window.getSelection()?.removeAllRanges()
    
    advanceOne()
    spaceHoldTimerRef.current = setTimeout(() => {
      spaceRepeatRef.current = setInterval(advanceOne, speedRef.current)
    }, HOLD_INITIAL_DELAY)
  }, [advanceOne])

  // ---- keyboard listeners & blur handlers ----
  useEffect(() => {
    const cancelAll = () => { stopSpace(); stopBksp() }

    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === "Space") { e.preventDefault(); if (!e.repeat) startSpace() }
      if (e.code === "Backspace") { e.preventDefault(); if (!e.repeat) startBksp() }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") stopSpace()
      if (e.code === "Backspace") stopBksp()
    }
    
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", cancelAll)
    window.addEventListener("contextmenu", cancelAll)
    
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("blur", cancelAll)
      window.removeEventListener("contextmenu", cancelAll)
      cancelAll()
    }
  }, [startSpace, stopSpace, startBksp, stopBksp])

  const ext = file.name.split(".").pop()?.toUpperCase() ?? "DOC"
  const sizeKb = (file.size / 1024).toFixed(0)
  const progressPct = totalWords > 0 ? Math.round(((readIndex + 1) / totalWords) * 100) : 0
  const fontFamily = FONT_FAMILIES[settings.font]

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      <header
        className="sticky top-0 z-10 border-b backdrop-blur-sm"
        style={{ borderColor, backgroundColor: headerBg }}
      >
        <div className="max-w-4xl mx-auto px-4 h-12 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onClose}
              aria-label="Close document"
              className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: mutedColor }}
            >
              <ArrowLeftIcon />
            </button>

            <div className="min-w-0 truncate">
              <p className="text-sm font-medium truncate leading-tight">{file.name}</p>
              <p className="text-xs leading-tight opacity-80" style={{ color: mutedColor }}>
                {ext} &middot; {sizeKb} KB
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Settings Dropdown Wrapper */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{ borderColor, color: mutedColor }}
              >
                <SettingsIcon />
                Settings
              </button>

              {menuOpen && (
                <div 
                  data-settings-panel
                  className="absolute top-full right-0 mt-2 w-72 p-3 rounded-lg border shadow-xl z-50 flex flex-col gap-4"
                  style={{ backgroundColor: bgColor, borderColor, color: textColor }}
                >
                  
                  {/* Font Selector */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: mutedColor }}>Font Style</label>
                    <select 
                      value={settings.font} 
                      onChange={(e) => updateSettings({ font: e.target.value as FontChoice })}
                      className="w-full text-xs p-1.5 rounded border bg-transparent"
                      style={{ borderColor, color: textColor }}
                    >
                      {(Object.keys(FONT_LABELS) as FontChoice[]).map(f => (
                        <option key={f} value={f} style={{ background: bgColor }}>{FONT_LABELS[f]}</option>
                      ))}
                    </select>
                  </div>

                  {/* Mode Selector */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: mutedColor }}>Read Mode</label>
                    <select 
                      value={settings.readMode} 
                      onChange={(e) => updateSettings({ readMode: e.target.value as ReadMode })}
                      className="w-full text-xs p-1.5 rounded border bg-transparent"
                      style={{ borderColor, color: textColor }}
                    >
                      <option value="word" style={{ background: bgColor }}>Word-by-Word</option>
                      <option value="letter" style={{ background: bgColor }}>Letter-by-Letter</option>
                    </select>
                  </div>

                  {/* Speed Selector */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: mutedColor }}>Hold Speed (ms)</label>
                    <div className="flex gap-2 items-center">
                      <input 
                        type="number" 
                        min="10" 
                        max="1000"
                        value={settings.speedMs}
                        onChange={(e) => updateSettings({ speedMs: Number(e.target.value) || 90 })}
                        className="w-16 text-xs p-1.5 rounded border bg-transparent text-center"
                        style={{ borderColor, color: textColor }}
                      />
                      <div className="flex gap-1">
                        {SPEED_PRESETS.map(p => (
                          <button 
                            key={p.label}
                            onClick={() => updateSettings({ speedMs: p.value })}
                            className="text-xs px-2.5 py-1.5 rounded border hover:bg-black/5 dark:hover:bg-white/5"
                            style={{ borderColor, color: settings.speedMs === p.value ? textColor : mutedColor }}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Skip Headings */}
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium cursor-pointer select-none" htmlFor="skip-headings">Auto-Skip Headings</label>
                    <button
                      id="skip-headings"
                      onClick={() => updateSettings({ skipHeadings: !settings.skipHeadings })}
                      className="w-4 h-4 rounded border flex items-center justify-center transition-colors focus:outline-none"
                      style={{ 
                        borderColor, 
                        backgroundColor: settings.skipHeadings ? "rgb(249, 115, 22)" : "rgba(128,128,128,0.1)",
                        color: "#fff" // checkmark white for contrast against orange
                      }}
                    >
                      {settings.skipHeadings && <CheckIcon />}
                    </button>
                  </div>

                  {/* Pinch to Scale */}
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium cursor-pointer select-none" htmlFor="pinch-scale">Auto-Scale (Pinch)</label>
                    <button
                      id="pinch-scale"
                      onClick={() => updateSettings({ pinchToScale: !settings.pinchToScale })}
                      className="w-4 h-4 rounded border flex items-center justify-center transition-colors focus:outline-none"
                      style={{ 
                        borderColor, 
                        backgroundColor: settings.pinchToScale ? "rgb(249, 115, 22)" : "rgba(128,128,128,0.1)",
                        color: "#fff"
                      }}
                    >
                      {settings.pinchToScale && <CheckIcon />}
                    </button>
                  </div>

                </div>
              )}
            </div>

            <div className="w-px h-4" style={{ backgroundColor: borderColor }} />

            <button
              onClick={onToggleBg}
              title={isDark ? "Switch to light" : "Switch to dark"}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ borderColor, color: mutedColor }}
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>

        {!loading && !error && type !== "html" && (
          <div
            className="desktop-hints items-center justify-center gap-2 text-xs py-1.5 select-none border-t relative"
            style={{ color: mutedColor, borderColor }}
          >
            {bkspProgress > 0 && (
              <span className="inline-block rounded-sm overflow-hidden" style={{ width: 32, height: 4, backgroundColor: borderColor }} aria-hidden="true">
                <span className="block h-full rounded-sm" style={{ width: `${bkspProgress}%`, backgroundColor: "rgba(239,68,68,0.7)" }} />
              </span>
            )}
            <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono border" style={{ borderColor, color: mutedColor, backgroundColor: "transparent" }}>Space</kbd>
            <span>to advance</span>
            <span style={{ color: borderColor }}>·</span>
            <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono border" style={{ borderColor, color: mutedColor, backgroundColor: "transparent" }}>Backspace</kbd>
            <span>to step back</span>
            <span style={{ color: borderColor }}>·</span>
            <span>hold to clear</span>
            
            {/* X% Read centered perfectly relative to the bar */}
            {totalWords > 0 && readIndex >= 0 && (
              <div className="absolute top-1.5 right-4 font-bold text-xs" style={{ color: textColor }}>
                {progressPct}% read
              </div>
            )}
          </div>
        )}

        {/* read-progress bar */}
        {totalWords > 0 && (
          <div className="h-0.5 w-full" style={{ backgroundColor: borderColor }}>
            <div className="h-full transition-all duration-75" style={{ width: `${progressPct}%`, backgroundColor: "rgba(250,204,21,0.65)" }} />
          </div>
        )}
      </header>

      {/* ---- Main content ---- */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-10 pb-32">
        {loading && (
          <div className="flex items-center justify-center h-40">
            <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor, borderTopColor: textColor }} aria-label="Loading" />
          </div>
        )}

        {error && (
          <div className="rounded-xl border px-5 py-4 text-sm" style={{ borderColor: "#f87171", backgroundColor: "rgba(239,68,68,0.08)", color: "#ef4444" }} role="alert">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {totalWords > 0 && readIndex >= 0 && (
              <div className="text-center mb-8 opacity-50 text-xs tracking-widest uppercase font-bold" style={{ color: mutedColor }}>
                {progressPct}% Read
              </div>
            )}

            {(type === "docx" || type === "text" || type === "pdf") && (
              <div ref={wrapperRef} style={{ color: textColor, fontFamily, fontSize: settings.fontSize }} />
            )}

            {type === "markdown" && (
              <MarkdownContent
                source={rawHtml}
                textColor={textColor}
                hlColor={hlColor}
                fontFamily={fontFamily}
                fontSize={settings.fontSize}
                readMode={settings.readMode}
                onWrapped={(count, map) => {
                  setTotalWords(count)
                  totalWordsRef.current = count
                  wordSpanMapRef.current = map
                  setReadIndex(-1)
                  readIndexRef.current = -1
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

      {/* ---- Mobile Touch Controls ---- */}
      {!loading && !error && type !== "html" && (
        <div
          data-mobile-controls
          className="touch-controls fixed bottom-6 left-4 right-4 gap-3 z-40"
          style={{
            userSelect: "none",
            WebkitUserSelect: "none",
          } as React.CSSProperties}
        >
          {/* Back button */}
          <div className="relative flex-1">
            <button
              className="w-full py-5 border rounded-2xl transition-transform active:scale-95 flex items-center justify-center outline-none"
              style={{
                borderColor,
                backgroundColor: headerBg,
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                userSelect: "none",
                WebkitUserSelect: "none",
                touchAction: "none", // Critical for Android
                WebkitTouchCallout: "none",
              } as React.CSSProperties}
              onTouchStart={(e) => { e.preventDefault(); startBksp(); }}
              onTouchEnd={(e) => { e.preventDefault(); stopBksp(); }}
              onTouchCancel={(e) => { e.preventDefault(); stopBksp(); }}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); return false; }}
            >
              <span className="font-semibold text-sm tracking-wide pointer-events-none select-none" style={{ color: textColor }}>
                ← Back
              </span>
            </button>
            {bkspProgress > 0 && <BorderTrace progress={bkspProgress} />}
          </div>

          {/* Advance button */}
          <div className="relative flex-[2]">
            <button
              className="w-full py-5 border rounded-2xl transition-transform active:scale-95 flex items-center justify-center outline-none"
              style={{
                borderColor,
                backgroundColor: headerBg,
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                userSelect: "none",
                WebkitUserSelect: "none",
                touchAction: "none", // Critical for Android
                WebkitTouchCallout: "none",
              } as React.CSSProperties}
              onTouchStart={(e) => { e.preventDefault(); startSpace(); }}
              onTouchEnd={(e) => { e.preventDefault(); stopSpace(); }}
              onTouchCancel={(e) => { e.preventDefault(); stopSpace(); }}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); return false; }}
            >
              <span className="font-semibold text-sm tracking-wide pointer-events-none select-none" style={{ color: textColor }}>
                Advance →
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Markdown sub-component ----
interface MarkdownContentProps {
  source: string
  textColor: string
  hlColor: string
  fontFamily: string
  fontSize: number
  readIndex: number
  readMode: ReadMode
  onWrapped: (count: number, map: Map<number, HTMLSpanElement>) => void
}

function MarkdownContent({ source, textColor, hlColor, fontFamily, fontSize, readIndex, readMode, onWrapped }: MarkdownContentProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.querySelectorAll<HTMLSpanElement>(".doc-word").forEach((s) => {
      s.replaceWith(document.createTextNode(s.textContent ?? ""))
    })
    el.normalize()
    const count = wrapWordsInRoot(el, readMode)
    const map = new Map<number, HTMLSpanElement>()
    el.querySelectorAll<HTMLSpanElement>(".doc-word[data-word]").forEach(span => {
      map.set(Number(span.dataset.word), span)
    })
    onWrapped(count, map)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, readMode])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.querySelectorAll<HTMLSpanElement>(".doc-word[data-word]").forEach((span) => {
      const i = Number(span.dataset.word)
      const shouldBe = i <= readIndex
      const isCurrent = span.style.backgroundColor !== ""
      if (shouldBe !== isCurrent) {
        span.style.backgroundColor = shouldBe ? hlColor : ""
        span.style.borderRadius = shouldBe ? "2px" : ""
      }
      if (i === readIndex) span.scrollIntoView({ behavior: "smooth", block: "center" })
    })
  }, [readIndex, hlColor])

  return (
    <div 
      ref={ref} 
      className="prose-doc" 
      style={{ color: textColor, fontFamily, fontSize }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} rehypePlugins={[rehypeRaw]}>
        {source}
      </ReactMarkdown>
    </div>
  )
}

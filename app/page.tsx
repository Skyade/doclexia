"use client"

import { useEffect, useState, useCallback } from "react"
import { DropZone } from "@/components/drop-zone"
import { DocumentViewer } from "@/components/document-viewer"
import type { BgMode } from "@/components/document-viewer"
import { loadSession, saveSession, clearSession, getHistory, removeFromHistory } from "@/lib/db"
import type { HistoryItem } from "@/lib/db"

const LS_KEY = "docviewer-bg"

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [isDocActive, setIsDocActive] = useState(false)
  const [initialIndex, setInitialIndex] = useState(-1)
  const [bg, setBg] = useState<BgMode>("light")
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [mounted, setMounted] = useState(false)
  const [themeBlur, setThemeBlur] = useState(false)



  // Load preference and saved session on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved === "dark" || saved === "light") {
        setBg(saved)
        // Apply immediately on mount
        document.documentElement.style.backgroundColor = saved === 'dark' ? '#141414' : '#ffffff'
        if (saved === 'dark') document.documentElement.classList.add('dark')
        else document.documentElement.classList.remove('dark')
      }
    } catch {}

    loadSession().then((session) => {
      if (session) {
        setInitialIndex(session.index)
        setFile(session.file)
        setIsDocActive(true)
      }
    }).finally(() => {
      setMounted(true)
    })

    getHistory().then(setHistory)
  }, [])

  // Handle global Paste (Ctrl+V)
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      if (file) return // don't interrupt if a document is already open
      
      const items = e.clipboardData?.items
      if (!items) return

      // Check for files first (e.g., copied a .docx file)
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === "file") {
          const pastedFile = items[i].getAsFile()
          if (pastedFile) {
            handleFile(pastedFile)
            return
          }
        }
      }

      // Fallback: check for raw text
      const text = e.clipboardData?.getData("text")
      if (text && text.trim().length > 0) {
        const textFile = new File([text], "Pasted Text.txt", { type: "text/plain" })
        handleFile(textFile)
      }
    }

    window.addEventListener("paste", handlePaste)
    return () => window.removeEventListener("paste", handlePaste)
  }, [file])

  // Sync document root when bg changes
  useEffect(() => {
    if (!mounted) return
    try {
      localStorage.setItem(LS_KEY, bg)
      document.documentElement.style.backgroundColor = bg === 'dark' ? '#141414' : '#ffffff'
      if (bg === 'dark') document.documentElement.classList.add('dark')
      else document.documentElement.classList.remove('dark')
    } catch {}
  }, [bg, mounted])

  const toggleBg = () => {
    setThemeBlur(true)
    setTimeout(() => setThemeBlur(false), 250)
    setBg((prev) => prev === "dark" ? "light" : "dark")
  }

  const handleFile = useCallback((newFile: File) => {
    setInitialIndex(-1)
    setFile(newFile)
    setTimeout(() => setIsDocActive(true), 10)
    saveSession(newFile, -1).then(() => {
      getHistory().then(setHistory)
    })
  }, [])

  const handleHistoryOpen = useCallback((item: HistoryItem) => {
    const historyFile = new File([item.buffer], item.name, { type: item.type })
    setInitialIndex(item.index)
    setFile(historyFile)
    setTimeout(() => setIsDocActive(true), 10)
    saveSession(historyFile, item.index, item.totalWords)
  }, [])

  const handleRemoveHistory = useCallback(async (id: string) => {
    await removeFromHistory(id)
    getHistory().then(setHistory)
  }, [])

  const handleClose = useCallback(() => {
    setIsDocActive(false)
    setTimeout(() => {
      setFile(null)
      setInitialIndex(-1)
      clearSession()
      getHistory().then(setHistory) // refresh history with latest progress
    }, 300)
  }, [])

  if (!mounted) return null

  return (
    <div 
      className="relative min-h-screen w-full bg-background overflow-hidden"
      style={{ 
        filter: themeBlur ? "blur(4px)" : "none",
        transition: "filter 250ms ease"
      }}
    >
      {/* MAIN VIEW */}
      <div 
        className="fixed inset-0 w-full h-full overflow-y-auto"
        style={{
          opacity: isDocActive ? 0 : 1,
          filter: isDocActive ? "blur(3px)" : "none",
          pointerEvents: isDocActive ? "none" : "auto",
          transition: "opacity 250ms ease, filter 250ms ease, background-color 250ms ease",
          willChange: "opacity, filter",
          zIndex: 1,
          backgroundColor: "var(--background)"
        }}
      >
        <DropZone 
          onFile={handleFile} 
          bg={bg} 
          onToggleBg={toggleBg} 
          history={history}
          onHistoryOpen={handleHistoryOpen}
          onHistoryRemove={handleRemoveHistory}
        />
      </div>

      {/* DOC VIEW */}
      <div 
        className="fixed inset-0 w-full h-full overflow-y-auto"
        style={{
          opacity: isDocActive ? 1 : 0,
          filter: isDocActive ? "none" : "blur(3px)",
          pointerEvents: isDocActive ? "auto" : "none",
          transition: "opacity 250ms ease, filter 250ms ease, background-color 250ms ease",
          willChange: "opacity, filter",
          zIndex: 2,
          backgroundColor: "var(--background)"
        }}
      >
        {file && (
          <DocumentViewer 
            file={file} 
            onClose={handleClose} 
            bg={bg} 
            onToggleBg={toggleBg} 
            initialIndex={initialIndex}
            onIndexChange={(idx, total) => saveSession(file, idx, total)}
          />
        )}
      </div>
    </div>
  )
}

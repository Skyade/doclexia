"use client"

import { useEffect, useState } from "react"
import { DropZone } from "@/components/drop-zone"
import { DocumentViewer } from "@/components/document-viewer"
import type { BgMode } from "@/components/document-viewer"
import { loadSession, saveSession, clearSession } from "@/lib/db"

const LS_KEY = "docviewer-bg"

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [initialIndex, setInitialIndex] = useState(-1)
  const [bg, setBg] = useState<BgMode>("light")

  // Load preference and saved session on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved === "dark" || saved === "light") setBg(saved)
    } catch {}

    loadSession().then((session) => {
      if (session) {
        setInitialIndex(session.index)
        setFile(session.file)
      }
    })
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

  const toggleBg = () => {
    setBg((prev) => {
      const next: BgMode = prev === "dark" ? "light" : "dark"
      try { localStorage.setItem(LS_KEY, next) } catch {}
      return next
    })
  }

  const handleFile = (newFile: File) => {
    setInitialIndex(-1)
    setFile(newFile)
    saveSession(newFile, -1)
  }

  const handleClose = () => {
    setFile(null)
    setInitialIndex(-1)
    clearSession()
  }

  return file ? (
    <DocumentViewer 
      file={file} 
      onClose={handleClose} 
      bg={bg} 
      onToggleBg={toggleBg} 
      initialIndex={initialIndex}
      onIndexChange={(idx) => saveSession(file, idx)}
    />
  ) : (
    <DropZone onFile={handleFile} bg={bg} onToggleBg={toggleBg} />
  )
}

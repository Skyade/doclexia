"use client"

import { useEffect, useState } from "react"
import { DropZone } from "@/components/drop-zone"
import { DocumentViewer } from "@/components/document-viewer"
import type { BgMode } from "@/components/document-viewer"

const LS_KEY = "docviewer-bg"

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [bg, setBg] = useState<BgMode>("light")

  // Load preference on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved === "dark" || saved === "light") setBg(saved)
    } catch {}
  }, [])

  const toggleBg = () => {
    setBg((prev) => {
      const next: BgMode = prev === "dark" ? "light" : "dark"
      try { localStorage.setItem(LS_KEY, next) } catch {}
      return next
    })
  }

  return file ? (
    <DocumentViewer file={file} onClose={() => setFile(null)} bg={bg} onToggleBg={toggleBg} />
  ) : (
    <DropZone onFile={setFile} bg={bg} onToggleBg={toggleBg} />
  )
}

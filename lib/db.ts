export const DB_NAME = "doclexia-db"
export const STORE_NAME = "session"
export const HISTORY_STORE = "history"

export interface HistoryItem {
  id: string
  name: string
  type: string
  buffer: ArrayBuffer
  index: number
  totalWords: number
  lastOpened: number
}

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        db.createObjectStore(HISTORY_STORE, { keyPath: "id" })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveSession(file: File, index: number, totalWords?: number) {
  try {
    const buffer = await file.arrayBuffer()
    const db = await getDB()
    const id = `${file.name}-${file.size}`

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_NAME, HISTORY_STORE], "readwrite")

      // Save active session
      tx.objectStore(STORE_NAME).put(
        { buffer, name: file.name, type: file.type, index, totalWords: totalWords ?? 0 },
        "lastSession"
      )

      // Upsert history entry — read first to preserve buffer on updates
      const historyStore = tx.objectStore(HISTORY_STORE)
      const getReq = historyStore.get(id)
      getReq.onsuccess = () => {
        const existing = getReq.result
        if (existing) {
          // Only update progress metadata, keep existing buffer
          existing.index = index
          existing.totalWords = totalWords ?? existing.totalWords
          existing.lastOpened = Date.now()
          historyStore.put(existing)
        } else {
          historyStore.put({
            id,
            name: file.name,
            type: file.type,
            buffer,
            index,
            totalWords: totalWords ?? 0,
            lastOpened: Date.now(),
          })
        }
      }

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.error("Failed to save session:", err)
  }
}

export async function loadSession(): Promise<{ file: File; index: number } | null> {
  try {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly")
      const request = tx.objectStore(STORE_NAME).get("lastSession")
      request.onsuccess = () => {
        const res = request.result
        if (res && res.buffer) {
          const file = new File([res.buffer], res.name, { type: res.type })
          resolve({ file, index: res.index })
        } else {
          resolve(null)
        }
      }
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.error("Failed to load session:", err)
    return null
  }
}

export async function clearSession() {
  try {
    const db = await getDB()
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite")
      tx.objectStore(STORE_NAME).delete("lastSession")
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.error("Failed to clear session:", err)
  }
}

export async function getHistory(): Promise<HistoryItem[]> {
  try {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(HISTORY_STORE, "readonly")
      const request = tx.objectStore(HISTORY_STORE).getAll()
      request.onsuccess = () => {
        const items: HistoryItem[] = request.result || []
        // Most recently opened first
        items.sort((a, b) => b.lastOpened - a.lastOpened)
        resolve(items)
      }
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.error("Failed to get history:", err)
    return []
  }
}

export async function removeFromHistory(id: string) {
  try {
    const db = await getDB()
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(HISTORY_STORE, "readwrite")
      tx.objectStore(HISTORY_STORE).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.error("Failed to remove from history:", err)
  }
}

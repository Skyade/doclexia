export const DB_NAME = "doclexia-db"
export const STORE_NAME = "session"

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveSession(file: File, index: number) {
  try {
    // Store as ArrayBuffer to ensure it persists across browser restarts reliably
    const buffer = await file.arrayBuffer()
    const db = await getDB()
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite")
      tx.objectStore(STORE_NAME).put({ buffer, name: file.name, type: file.type, index }, "lastSession")
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

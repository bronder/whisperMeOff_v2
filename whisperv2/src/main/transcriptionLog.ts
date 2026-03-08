// @ts-ignore - sql.js doesn't have type declarations
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import { app } from 'electron'
import { join } from 'path'
import * as fs from 'fs'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null
let dbPath: string = ''

export interface TranscriptionRecord {
  id: number
  text: string
  timestamp: string
  duration: number | null
  model: string | null
  language: string | null
}

function saveDb(): void {
  if (db && dbPath) {
    const data = db.export()
    const buffer = Buffer.from(data)
    fs.writeFileSync(dbPath, buffer)
  }
}

export async function initTranscriptionLog(): Promise<void> {
  dbPath = join(app.getPath('userData'), 'transcriptions.db')
  
  // Ensure directory exists
  const dir = app.getPath('userData')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  
  const SQL = await initSqlJs()
  
  // Load existing database or create new one
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }
  
  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS transcriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      duration REAL,
      model TEXT,
      language TEXT
    )
  `)
  
  saveDb()
  
  console.log('[TranscriptionLog] Database initialized at:', dbPath)
}

export function logTranscription(
  text: string,
  duration?: number,
  model?: string,
  language?: string
): number {
  if (!db) {
    console.error('[TranscriptionLog] Database not initialized')
    return -1
  }
  
  const timestamp = new Date().toISOString()
  
  db.run(
    `INSERT INTO transcriptions (text, timestamp, duration, model, language) VALUES (?, ?, ?, ?, ?)`,
    [text, timestamp, duration ?? null, model ?? null, language ?? null]
  )
  
  // Get the last inserted id
  const result = db.exec('SELECT last_insert_rowid() as id')
  const id = result[0]?.values[0]?.[0] as number || -1
  
  saveDb()
  console.log('[TranscriptionLog] Logged transcription:', id)
  
  return id
}

export function getTranscriptions(limit: number = 100): TranscriptionRecord[] {
  if (!db) {
    console.error('[TranscriptionLog] Database not initialized')
    return []
  }
  
  const result = db.exec(`
    SELECT id, text, timestamp, duration, model, language
    FROM transcriptions
    ORDER BY timestamp DESC
    LIMIT ?
  `, [limit])
  
  if (!result[0]) {
    return []
  }
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result[0].values.map((row: any[]) => ({
    id: row[0] as number,
    text: row[1] as string,
    timestamp: row[2] as string,
    duration: row[3] as number | null,
    model: row[4] as string | null,
    language: row[5] as string | null
  }))
}

export function getTranscription(id: number): TranscriptionRecord | null {
  if (!db) {
    console.error('[TranscriptionLog] Database not initialized')
    return null
  }
  
  const result = db.exec(`
    SELECT id, text, timestamp, duration, model, language
    FROM transcriptions
    WHERE id = ?
  `, [id])
  
  if (!result[0] || !result[0].values[0]) {
    return null
  }
  
  const row = result[0].values[0]
  return {
    id: row[0] as number,
    text: row[1] as string,
    timestamp: row[2] as string,
    duration: row[3] as number | null,
    model: row[4] as string | null,
    language: row[5] as string | null
  }
}

export function deleteTranscription(id: number): boolean {
  if (!db) {
    console.error('[TranscriptionLog] Database not initialized')
    return false
  }
  
  db.run('DELETE FROM transcriptions WHERE id = ?', [id])
  saveDb()
  return true
}

export function clearTranscriptions(): boolean {
  if (!db) {
    console.error('[TranscriptionLog] Database not initialized')
    return false
  }
  
  db.run('DELETE FROM transcriptions')
  saveDb()
  console.log('[TranscriptionLog] Cleared all transcriptions')
  
  return true
}

export function closeTranscriptionLog(): void {
  if (db) {
    saveDb()
    db.close()
    db = null
    console.log('[TranscriptionLog] Database closed')
  }
}

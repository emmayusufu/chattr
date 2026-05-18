import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname, resolve } from "path";

const dataDir = process.env.DATA_DIR ?? "./data";
const dbPath = resolve(dataDir, "chattr.db");

mkdirSync(dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");

db.exec(`DROP TABLE IF EXISTS scratchpad;`);
db.exec(`
  CREATE TABLE IF NOT EXISTS scratchpad (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    update_blob BLOB NOT NULL,
    created_at INTEGER NOT NULL
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_scratchpad_room ON scratchpad(room_id, id);`);

const insertStmt = db.prepare(
  `INSERT INTO scratchpad (room_id, update_blob, created_at) VALUES (?, ?, ?)`
);

const loadStmt = db.prepare<string, { update_blob: Buffer }>(
  `SELECT update_blob FROM scratchpad WHERE room_id = ? ORDER BY id ASC`
);

export function appendScratchpadUpdate(roomId: string, update: Uint8Array): void {
  insertStmt.run(roomId, Buffer.from(update), Date.now());
}

export function loadScratchpadLog(roomId: string): Uint8Array[] {
  const rows = loadStmt.all(roomId);
  return rows.map((r) => new Uint8Array(r.update_blob));
}

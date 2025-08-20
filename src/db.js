import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbFile = process.env.DATABASE_FILE || './data/catalog.db';


fs.mkdirSync(path.dirname(dbFile), { recursive: true });

export const db = new Database(dbFile);
db.pragma('foreign_keys = ON');

export function runMigrations() {
  const migrationsDir = path.resolve(__dirname, '..', 'migrations');
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      run_at TEXT DEFAULT (datetime('now'))
    );
  `);
  const applied = new Set(db.prepare('SELECT name FROM migrations').all().map(r => r.name));
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  db.transaction(() => {
    for (const f of files) {
      if (applied.has(f)) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf-8');
      db.exec(sql);
      db.prepare('INSERT INTO migrations (name) VALUES (?)').run(f);
    }
  })();
}
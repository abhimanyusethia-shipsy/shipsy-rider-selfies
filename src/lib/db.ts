import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { hashPassword } from "./auth";

const DB_PATH = path.join(process.cwd(), "data", "selfie-checker.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(path.join(process.cwd(), "data", "uploads", "profiles"), { recursive: true });
  fs.mkdirSync(path.join(process.cwd(), "data", "uploads", "selfies"), { recursive: true });

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS profile_pictures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      image_path TEXT NOT NULL,
      ai_valid INTEGER DEFAULT 0,
      ai_reasoning TEXT,
      uploaded_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS selfies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      image_path TEXT NOT NULL,
      profile_picture_id INTEGER REFERENCES profile_pictures(id),
      ai_status TEXT DEFAULT 'pending',
      ai_reasoning TEXT,
      ai_face_valid INTEGER DEFAULT 0,
      ai_real_person INTEGER DEFAULT 0,
      ai_face_match INTEGER DEFAULT 0,
      uploaded_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Seed users from config
  seedUsers(db);

  return db;
}

function seedUsers(db: Database.Database) {
  const configPath = path.join(process.cwd(), "config", "users.json");
  if (!fs.existsSync(configPath)) return;

  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const upsert = db.prepare(`
    INSERT INTO users (username, password_hash, display_name)
    VALUES (?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET
      password_hash = excluded.password_hash,
      display_name = excluded.display_name
  `);

  for (const user of config.users) {
    const hash = hashPassword(user.password);
    upsert.run(user.username, hash, user.display_name);
  }
}

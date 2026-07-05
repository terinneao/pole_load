import Database from 'better-sqlite3';
import path from 'path';

// Define the database path
const dbPath = path.join(process.cwd(), 'conductors.db');

// Initialize the database
const db = new Database(dbPath);

// Create the table and seed some data if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS conductors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    diameter_mm REAL NOT NULL,
    weight_kg_m REAL NOT NULL
  );
`);

// Check if we need to seed data
const stmt = db.prepare('SELECT count(*) as count FROM conductors');
const row = stmt.get();

if (row.count === 0) {
  const insert = db.prepare('INSERT INTO conductors (name, diameter_mm, weight_kg_m) VALUES (?, ?, ?)');
  
  const seedData = [
    { name: 'ACSR 35/6 (Sparrow)', diameter_mm: 6.33, weight_kg_m: 0.109 },
    { name: 'ACSR 50/8 (Raven)', diameter_mm: 8.1, weight_kg_m: 0.17 },
    { name: 'ACSR 95/15 (Dog)', diameter_mm: 14.15, weight_kg_m: 0.394 },
    { name: 'ACSR 120/20 (Panther)', diameter_mm: 21.0, weight_kg_m: 0.976 },
    { name: 'AAAC 50', diameter_mm: 9.0, weight_kg_m: 0.145 },
    { name: 'AAAC 100', diameter_mm: 13.0, weight_kg_m: 0.295 },
  ];

  db.transaction(() => {
    for (const conductor of seedData) {
      insert.run(conductor.name, conductor.diameter_mm, conductor.weight_kg_m);
    }
  })();
}

export default db;

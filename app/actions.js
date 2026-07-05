'use server';

import db from '@/lib/db';

export async function getConductors() {
  const stmt = db.prepare('SELECT * FROM conductors ORDER BY diameter_mm ASC');
  return stmt.all();
}

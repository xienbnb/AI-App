import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Get-or-create the database singleton.
 */
async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync("novelapp.db");
  }
  return db;
}

// ---------------------------------------------------------------------------
// initDatabase
// ---------------------------------------------------------------------------

export async function initDatabase(): Promise<void> {
  const database = await getDb();

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS books (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      coverUrl    TEXT NOT NULL DEFAULT '',
      userId      TEXT NOT NULL DEFAULT '',
      createdAt   TEXT NOT NULL DEFAULT '',
      updatedAt   TEXT NOT NULL DEFAULT '',
      syncStatus  TEXT NOT NULL DEFAULT 'local_only'
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id         TEXT PRIMARY KEY,
      bookId     TEXT NOT NULL DEFAULT '',
      title      TEXT NOT NULL DEFAULT '',
      content    TEXT NOT NULL DEFAULT '',
      "order"    INTEGER NOT NULL DEFAULT 0,
      wordCount  INTEGER NOT NULL DEFAULT 0,
      createdAt  TEXT NOT NULL DEFAULT '',
      updatedAt  TEXT NOT NULL DEFAULT '',
      syncStatus TEXT NOT NULL DEFAULT 'local_only'
    );

    CREATE TABLE IF NOT EXISTS outlines (
      id         TEXT PRIMARY KEY,
      bookId     TEXT NOT NULL DEFAULT '',
      title      TEXT NOT NULL DEFAULT '',
      content    TEXT NOT NULL DEFAULT '',
      "order"    INTEGER NOT NULL DEFAULT 0,
      createdAt  TEXT NOT NULL DEFAULT '',
      updatedAt  TEXT NOT NULL DEFAULT '',
      syncStatus TEXT NOT NULL DEFAULT 'local_only'
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );
  `);
}

// ---------------------------------------------------------------------------
// Books CRUD
// ---------------------------------------------------------------------------

export async function getBooks(userId: string): Promise<any[]> {
  const database = await getDb();
  const statement = await database.prepareAsync(
    "SELECT * FROM books WHERE userId = ? ORDER BY updatedAt DESC"
  );
  try {
    const result = await statement.executeAsync<any>(userId);
    return await result.getAllAsync();
  } finally {
    await statement.finalizeAsync();
  }
}

export async function getBook(id: string): Promise<any> {
  const database = await getDb();
  const statement = await database.prepareAsync(
    "SELECT * FROM books WHERE id = ?"
  );
  try {
    const result = await statement.executeAsync<any>(id);
    return await result.getFirstAsync();
  } finally {
    await statement.finalizeAsync();
  }
}

export async function saveBook(book: any): Promise<void> {
  const database = await getDb();
  const statement = await database.prepareAsync(
    `INSERT OR REPLACE INTO books (id, title, description, coverUrl, userId, createdAt, updatedAt, syncStatus)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  try {
    await statement.executeAsync(
      book.id,
      book.title ?? "",
      book.description ?? "",
      book.coverUrl ?? "",
      book.userId ?? "",
      book.createdAt ?? "",
      book.updatedAt ?? "",
      book.syncStatus ?? "local_only"
    );
  } finally {
    await statement.finalizeAsync();
  }
}

export async function deleteBook(id: string): Promise<void> {
  const database = await getDb();

  // Delete related chapters and outlines first
  const delChapters = await database.prepareAsync(
    "DELETE FROM chapters WHERE bookId = ?"
  );
  try {
    await delChapters.executeAsync(id);
  } finally {
    await delChapters.finalizeAsync();
  }

  const delOutlines = await database.prepareAsync(
    "DELETE FROM outlines WHERE bookId = ?"
  );
  try {
    await delOutlines.executeAsync(id);
  } finally {
    await delOutlines.finalizeAsync();
  }

  const delBook = await database.prepareAsync(
    "DELETE FROM books WHERE id = ?"
  );
  try {
    await delBook.executeAsync(id);
  } finally {
    await delBook.finalizeAsync();
  }
}

export async function getUnsyncedBooks(): Promise<any[]> {
  const database = await getDb();
  const statement = await database.prepareAsync(
    `SELECT * FROM books WHERE syncStatus IN ('pending_sync', 'local_only')`
  );
  try {
    const result = await statement.executeAsync<any>();
    return await result.getAllAsync();
  } finally {
    await statement.finalizeAsync();
  }
}

// ---------------------------------------------------------------------------
// Chapters CRUD
// ---------------------------------------------------------------------------

export async function getChapters(bookId: string): Promise<any[]> {
  const database = await getDb();
  const statement = await database.prepareAsync(
    "SELECT * FROM chapters WHERE bookId = ? ORDER BY \"order\" ASC"
  );
  try {
    const result = await statement.executeAsync<any>(bookId);
    return await result.getAllAsync();
  } finally {
    await statement.finalizeAsync();
  }
}

export async function getChapter(id: string): Promise<any> {
  const database = await getDb();
  const statement = await database.prepareAsync(
    "SELECT * FROM chapters WHERE id = ?"
  );
  try {
    const result = await statement.executeAsync<any>(id);
    return await result.getFirstAsync();
  } finally {
    await statement.finalizeAsync();
  }
}

export async function saveChapter(chapter: any): Promise<void> {
  const database = await getDb();
  const statement = await database.prepareAsync(
    `INSERT OR REPLACE INTO chapters (id, bookId, title, content, "order", wordCount, createdAt, updatedAt, syncStatus)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  try {
    await statement.executeAsync(
      chapter.id,
      chapter.bookId ?? "",
      chapter.title ?? "",
      chapter.content ?? "",
      chapter.order ?? 0,
      chapter.wordCount ?? 0,
      chapter.createdAt ?? "",
      chapter.updatedAt ?? "",
      chapter.syncStatus ?? "local_only"
    );
  } finally {
    await statement.finalizeAsync();
  }
}

export async function deleteChapter(id: string): Promise<void> {
  const database = await getDb();
  const statement = await database.prepareAsync(
    "DELETE FROM chapters WHERE id = ?"
  );
  try {
    await statement.executeAsync(id);
  } finally {
    await statement.finalizeAsync();
  }
}

export async function getUnsyncedChapters(): Promise<any[]> {
  const database = await getDb();
  const statement = await database.prepareAsync(
    `SELECT * FROM chapters WHERE syncStatus IN ('pending_sync', 'local_only')`
  );
  try {
    const result = await statement.executeAsync<any>();
    return await result.getAllAsync();
  } finally {
    await statement.finalizeAsync();
  }
}

// ---------------------------------------------------------------------------
// Outlines CRUD
// ---------------------------------------------------------------------------

export async function getOutlines(bookId: string): Promise<any[]> {
  const database = await getDb();
  const statement = await database.prepareAsync(
    "SELECT * FROM outlines WHERE bookId = ? ORDER BY \"order\" ASC"
  );
  try {
    const result = await statement.executeAsync<any>(bookId);
    return await result.getAllAsync();
  } finally {
    await statement.finalizeAsync();
  }
}

export async function getOutline(id: string): Promise<any> {
  const database = await getDb();
  const statement = await database.prepareAsync(
    "SELECT * FROM outlines WHERE id = ?"
  );
  try {
    const result = await statement.executeAsync<any>(id);
    return await result.getFirstAsync();
  } finally {
    await statement.finalizeAsync();
  }
}

export async function saveOutline(outline: any): Promise<void> {
  const database = await getDb();
  const statement = await database.prepareAsync(
    `INSERT OR REPLACE INTO outlines (id, bookId, title, content, "order", createdAt, updatedAt, syncStatus)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  try {
    await statement.executeAsync(
      outline.id,
      outline.bookId ?? "",
      outline.title ?? "",
      outline.content ?? "",
      outline.order ?? 0,
      outline.createdAt ?? "",
      outline.updatedAt ?? "",
      outline.syncStatus ?? "local_only"
    );
  } finally {
    await statement.finalizeAsync();
  }
}

export async function deleteOutline(id: string): Promise<void> {
  const database = await getDb();
  const statement = await database.prepareAsync(
    "DELETE FROM outlines WHERE id = ?"
  );
  try {
    await statement.executeAsync(id);
  } finally {
    await statement.finalizeAsync();
  }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function getSetting(key: string): Promise<string | null> {
  const database = await getDb();
  const statement = await database.prepareAsync(
    "SELECT value FROM settings WHERE key = ?"
  );
  try {
    const result = await statement.executeAsync<{ value: string }>(key);
    const row = await result.getFirstAsync();
    return row ? row.value : null;
  } finally {
    await statement.finalizeAsync();
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  const database = await getDb();
  const statement = await database.prepareAsync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)"
  );
  try {
    await statement.executeAsync(key, value);
  } finally {
    await statement.finalizeAsync();
  }
}
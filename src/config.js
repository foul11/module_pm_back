import sqlite from 'better-sqlite3';
import express from 'express';

export const db = new sqlite('./data.db', { verbose: console.log });
export const app = express();

db.prepare(`
    CREATE TABLE IF NOT EXISTS "task" (
        "id"	INTEGER,
        "listId"	INTEGER,
        "data"	TEXT NOT NULL,
        PRIMARY KEY("id" AUTOINCREMENT)
    )
`);
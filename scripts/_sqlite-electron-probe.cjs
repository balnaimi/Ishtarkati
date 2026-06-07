"use strict";
const Database = require("better-sqlite3");
const db = new Database(":memory:");
db.close();
console.log(`OK — Electron ABI ${process.versions.modules}`);

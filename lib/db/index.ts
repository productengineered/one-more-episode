import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// Local: file-based SQLite. On Vercel: set DATABASE_URL (+ DATABASE_AUTH_TOKEN) to a Turso database.
const client = createClient({
  url: process.env.DATABASE_URL ?? "file:./data/tv.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });

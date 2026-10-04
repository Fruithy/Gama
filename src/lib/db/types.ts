export type Row = Record<string, unknown>;

/** Minimal SQL surface shared by the PGlite (dev/test) and postgres.js (prod) drivers. */
export interface Db {
  /** Parameterised query ($1, $2…). Returns rows. */
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Run multi-statement SQL without parameters (migrations). */
  exec(sql: string): Promise<void>;
  /** Run `fn` inside a transaction. */
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  readonly kind: "pglite" | "postgres";
  close(): Promise<void>;
}

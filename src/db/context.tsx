import { createContext, createSignal, onMount, useContext, type JSX } from "solid-js";
import { getDB } from "./init";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = { sqlite3: any; db: number };

interface DbContextValue {
  db: () => DB | null;
  ready: () => boolean;
  error: () => string | null;
}

const DbContext = createContext<DbContextValue>();

export function DbProvider(props: { children: JSX.Element }) {
  const [db, setDb] = createSignal<DB | null>(null);
  const [ready, setReady] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      const instance = await getDB();
      setDb(instance);
      setReady(true);
    } catch (e) {
      console.error("[Crucible DB] Init failed:", e);
      setError(e instanceof Error ? e.message : "Database init failed");
    }
  });

  return (
    <DbContext.Provider value={{ db, ready, error }}>
      {props.children}
    </DbContext.Provider>
  );
}

export function useDb(): DbContextValue {
  const ctx = useContext(DbContext);
  if (!ctx) throw new Error("useDb must be used within DbProvider");
  return ctx;
}

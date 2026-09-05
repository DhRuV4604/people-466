/**
 * Keeps server-to-API connections alive.
 *
 * Each render makes several calls to the same API host. Node's global fetch
 * opens a fresh connection per call by default, so without this every page pays
 * TCP (and in production, TLS) setup several times over. The agent is installed
 * once at boot and applies to every fetch the server makes.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { Agent, setGlobalDispatcher } = await import("undici");

  setGlobalDispatcher(
    new Agent({
      keepAliveTimeout: 30_000,
      keepAliveMaxTimeout: 60_000,
      connections: 64,
    }),
  );
}

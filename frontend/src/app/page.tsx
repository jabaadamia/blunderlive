import { CORE_API_BASE, GAME_API_BASE } from "@/lib/api";

type HealthResult = { ok: boolean; body: string };

async function getHealth(url: string): Promise<HealthResult> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    const body = await response.text();
    return { ok: response.ok, body };
  } catch (error) {
    return { ok: false, body: `request failed: ${String(error)}` };
  }
}

const INTERNAL_CORE_URL =
  process.env.INTERNAL_CORE_URL ?? "http://core:8000";

const INTERNAL_GAME_URL =
  process.env.INTERNAL_GAME_URL ?? "http://game:8005";

export default async function Home() {
  const [coreHealth, gameHealth] = await Promise.all([
    getHealth(`${INTERNAL_CORE_URL}/health/`),
    getHealth(`${INTERNAL_GAME_URL}/health`),
  ]);

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>BlunderLive Frontend</h1>
      <p>Next.js is running in Docker.</p>
      <ul>
        <li>Core API: {CORE_API_BASE}</li>
        <li>Game API: {GAME_API_BASE}</li>
      </ul>
      <ul>
        <li>Core internal URL: {INTERNAL_CORE_URL}</li>
        <li>Game internal URL: {INTERNAL_GAME_URL}</li>
      </ul>
      <p>
        Core health: <strong>{coreHealth.ok ? "OK" : "FAILED"}</strong>
      </p>
      <pre>{coreHealth.body}</pre>
      <p>
        Game health: <strong>{gameHealth.ok ? "OK" : "FAILED"}</strong>
      </p>
      <pre>{gameHealth.body}</pre>
    </main>
  );
}

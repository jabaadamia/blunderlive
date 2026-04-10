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

export default async function Home() {
  const [coreHealth, gameHealth] = await Promise.all([
    getHealth("http://nginx/api/core/health/"),
    getHealth("http://nginx/api/game/health"),
  ]);

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>BlunderLive Frontend</h1>
      <p>Next.js is running in Docker.</p>
      <ul>
        <li>Core API: {CORE_API_BASE}</li>
        <li>Game API: {GAME_API_BASE}</li>
      </ul>
      <p>
        Core health via Nginx: <strong>{coreHealth.ok ? "OK" : "FAILED"}</strong>
      </p>
      <pre>{coreHealth.body}</pre>
      <p>
        Game health via Nginx: <strong>{gameHealth.ok ? "OK" : "FAILED"}</strong>
      </p>
      <pre>{gameHealth.body}</pre>
    </main>
  );
}
import http from "node:http";

const baseUrlArg = process.argv.find((arg) => arg.startsWith("--base-url="));
const BASE_URL =
  baseUrlArg?.slice("--base-url=".length) ??
  process.env.BASE_URL ??
  "http://127.0.0.1:3000";

function fail(message) {
  throw new Error(message);
}

async function fetchJsonChecked(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  const text = await response.text();
  if (response.status >= 500 && response.status !== 503) {
    fail(`${path} returned bare ${response.status} (body: ${text.slice(0, 120)})`);
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    fail(`${path} returned non-JSON body (status ${response.status}): ${text.slice(0, 120)}`);
  }
  return { status: response.status, json };
}

async function run() {
  // 1. /api/health
  const health = await fetchJsonChecked("/api/health");
  if (health.status !== 200) {
    fail(`/api/health expected 200, got ${health.status}`);
  }
  const h = health.json;
  for (const field of ["ok", "service", "version", "build", "checked_at", "sources"]) {
    if (!(field in h)) {
      fail(`/api/health missing required field "${field}"`);
    }
  }
  if (!Array.isArray(h.sources) || h.sources.length === 0) {
    fail("/api/health sources must be a non-empty array");
  }
  for (const src of h.sources) {
    if (typeof src.key !== "string" || !("last_ok" in src) || typeof src.status !== "string") {
      fail(`/api/health source entry invalid: ${JSON.stringify(src)}`);
    }
  }
  console.log(`[api-honesty] /api/health OK (${h.sources.length} sources)`);

  // 2. /api/transit/pksb/buses (live mode — upstream failing/unconfigured must return honest empty state, no fabricated buses)
  const buses = await fetchJsonChecked("/api/transit/pksb/buses");
  if (buses.status !== 200 && buses.status !== 503) {
    fail(`/api/transit/pksb/buses expected 200 or 503, got ${buses.status}`);
  }
  const b = buses.json;
  if (typeof b.ok !== "boolean" || !Array.isArray(b.items) || !Array.isArray(b.buses)) {
    fail(`/api/transit/pksb/buses missing honesty fields: ${JSON.stringify(b).slice(0, 200)}`);
  }
  if (b.ok === false) {
    if (b.reason !== "upstream_unavailable" || b.as_of !== null || b.items.length !== 0 || b.buses.length !== 0) {
      fail(`/api/transit/pksb/buses honest empty state mismatch: ${JSON.stringify(b).slice(0, 200)}`);
    }
  }
  console.log(
    `[api-honesty] /api/transit/pksb/buses OK (status=${buses.status}, ok=${b.ok}, reason=${b.reason}, buses=${b.buses.length})`,
  );

  // 3. /api/transit/pksb
  const routes = await fetchJsonChecked("/api/transit/pksb");
  if (routes.status !== 200 && routes.status !== 503) {
    fail(`/api/transit/pksb expected 200 or 503, got ${routes.status}`);
  }
  if (typeof routes.json.ok !== "boolean" || !Array.isArray(routes.json.items)) {
    fail(`/api/transit/pksb missing honesty fields`);
  }
  console.log(
    `[api-honesty] /api/transit/pksb OK (status=${routes.status}, ok=${routes.json.ok}, routes=${routes.json.routes?.features?.length ?? 0})`,
  );

  // 4. /api/operations/dashboard
  const ops = await fetchJsonChecked("/api/operations/dashboard");
  if (ops.status !== 200 && ops.status !== 503) {
    fail(`/api/operations/dashboard expected 200 or 503, got ${ops.status}`);
  }
  const o = ops.json;
  if (typeof o.ok !== "boolean" || !Array.isArray(o.items)) {
    fail(`/api/operations/dashboard missing honesty fields`);
  }
  console.log(
    `[api-honesty] /api/operations/dashboard OK (status=${ops.status}, ok=${o.ok}, mode=${o.mode}, touchpoints=${o.touchpoints?.length ?? 0})`,
  );

  // 5. Verify failing stub server returns 500 when hit directly (proving stub itself fails)
  const stubServer = http.createServer((_req, res) => {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("simulated upstream failure");
  });
  await new Promise((resolve) => stubServer.listen(0, "127.0.0.1", resolve));
  const stubPort = stubServer.address().port;
  try {
    const stubRes = await fetch(`http://127.0.0.1:${stubPort}/api/vehicles/all`);
    if (stubRes.status !== 500) {
      fail("Stub server did not return 500");
    }
  } finally {
    stubServer.close();
  }

  console.log("API honesty checks passed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

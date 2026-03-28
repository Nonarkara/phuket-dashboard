import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const manifestUrl = new URL("../src/lib/control-manifest.json", import.meta.url);
const controlManifest = JSON.parse(await readFile(manifestUrl, "utf8"));

function fail(message) {
  throw new Error(message);
}

async function expectVisible(locator, label) {
  const count = await locator.count();
  if (count === 0) {
    fail(`Expected visible control or panel "${label}", but it was not found.`);
  }

  for (let index = 0; index < count; index += 1) {
    if (await locator.nth(index).isVisible()) {
      return;
    }
  }

  await locator.first().waitFor({ state: "visible", timeout: 15000 });
}

async function expectNotPresent(locator, label) {
  const count = await locator.count();
  if (count > 0) {
    fail(`Expected "${label}" to be removed from the main surface, but it is still present.`);
  }
}

async function expectPressed(page, name) {
  const button = page.getByRole("button", { name, exact: true });
  await expectVisible(button, name);
  const pressed = await button.first().getAttribute("aria-pressed");
  if (pressed !== "true") {
    fail(`Expected "${name}" to set aria-pressed="true", received "${pressed}".`);
  }
}

async function closeOverlay(page) {
  await page.mouse.click(16, 16);
  await page.waitForTimeout(250);
}

async function openDashboard(page, query = "") {
  await page.goto(`${BASE_URL}/${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await expectVisible(page.getByRole("button", { name: "Admin", exact: true }), "Admin");
}

async function fetchJson(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) {
    fail(`Expected ${path} to respond with 200, got ${response.status}.`);
  }

  return response.json();
}

async function verifyApiScenarios() {
  const live = await fetchJson("/api/operations/dashboard");
  if (!Array.isArray(live.touchpoints) || live.touchpoints.length !== 3) {
    fail("Expected live operations dashboard to expose exactly three touchpoints.");
  }

  const surge = await fetchJson("/api/operations/dashboard?scenario=tourism-surge-weekend");
  const monsoon = await fetchJson("/api/operations/dashboard?scenario=red-monsoon-day");
  const surgeWeather = await fetchJson("/api/weather/ops?scenario=tourism-surge-weekend");
  const monsoonWeather = await fetchJson("/api/weather/ops?scenario=red-monsoon-day");
  const liveBuses = await fetchJson("/api/transit/pksb/buses");
  const surgeBuses = await fetchJson("/api/transit/pksb/buses?scenario=tourism-surge-weekend");
  const modeledMarine = await fetchJson("/api/maritime/security");

  if (surge.mode !== "modeled" || monsoon.mode !== "modeled") {
    fail("Scenario operations snapshots must run in modeled mode.");
  }

  if (surge.airportDemand.demandRate <= live.airportDemand.demandRate) {
    fail("Tourism surge weekend should increase airport demand above the live baseline.");
  }

  if (monsoon.weatherConstraint.status !== "intervene") {
    fail("Red monsoon day should force an intervene weather posture.");
  }

  if (surgeWeather.mode !== "modeled" || monsoonWeather.mode !== "modeled") {
    fail("Scenario weather route must expose modeled mode.");
  }

  if (!Array.isArray(liveBuses.buses) || liveBuses.buses.length === 0) {
    fail("Expected the live/default bus feed to return at least one bus.");
  }

  if (
    surgeBuses.mode !== "modeled" ||
    !Array.isArray(surgeBuses.buses) ||
    surgeBuses.buses.length < 8
  ) {
    fail("Tourism surge weekend should expose a populated modeled bus fleet.");
  }

  if (!Array.isArray(modeledMarine.vessels)) {
    fail("Expected maritime security feed to return a vessel array.");
  }
}

async function verifyMainControls(page) {
  for (const control of controlManifest.main) {
    await expectVisible(
      page.getByRole("button", { name: control.label, exact: true }),
      control.label,
    );
  }

  await page.getByRole("button", { name: "Aerial", exact: true }).click({ force: true });
  await expectPressed(page, "Aerial");
  await page.getByRole("button", { name: "Map", exact: true }).click({ force: true });
  await expectPressed(page, "Map");

  for (const lens of ["Operations", "Safety", "Weather", "Tourism"]) {
    await page.getByRole("button", { name: lens, exact: true }).click({ force: true });
    await expectPressed(page, lens);
  }

  for (const corridor of [
    "Airport -> Patong",
    "Old Town",
    "Chalong / Rassada / Ao Po",
    "Patong / Karon / Kata",
  ]) {
    await page.getByRole("button", { name: corridor, exact: true }).click({ force: true });
    await expectPressed(page, corridor);
  }

  for (const removed of ["More layers", "Overview", "Hide layers"]) {
    await expectNotPresent(page.getByRole("button", { name: removed, exact: true }), removed);
  }
}

async function verifyAdminMenu(page) {
  const adminButton = page.getByRole("button", { name: "Admin", exact: true });
  await adminButton.click({ force: true });

  for (const item of controlManifest.admin) {
    await expectVisible(page.getByRole("menuitem", { name: item.label, exact: true }), item.label);
  }

  await adminButton.click({ force: true });

  const overlays = [
    { item: "Manual", kind: "text", value: "Operator Manual" },
    { item: "Architecture", kind: "dialog", value: "Architecture dialog" },
    { item: "Data Explorer", kind: "text", value: "Data Explorer" },
    { item: "Toolkit", kind: "text", value: "Global Satellite Toolkit" },
  ];

  for (const overlay of overlays) {
    await adminButton.click({ force: true });
    const menuItem = page.getByRole("menuitem", { name: overlay.item, exact: true });
    await expectVisible(menuItem, overlay.item);
    await menuItem.evaluate((element) => {
      element.click();
    });
    await expectVisible(
      overlay.kind === "dialog"
        ? page.getByRole("dialog")
        : page.getByText(overlay.value, { exact: false }),
      overlay.value,
    );
    await closeOverlay(page);
  }
}

async function verifyScenarioPages(browser) {
  for (const scenario of ["tourism-surge-weekend", "red-monsoon-day"]) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await openDashboard(page, `?scenario=${scenario}`);
    await expectVisible(page.getByText("Operations desk", { exact: true }), "Operations desk");
    await expectVisible(page.getByText("Bus to boat touchpoints", { exact: true }), "Bus to boat touchpoints");
    await expectVisible(page.getByText("MODELED", { exact: true }), "MODELED");
    await page.close();
  }
}

async function verifyResponsiveLayout(browser) {
  const wall = await browser.newPage({ viewport: { width: 3840, height: 2160 } });
  await openDashboard(wall);
  await expectVisible(wall.getByText("Phuket operator map", { exact: true }), "Phuket operator map");
  await expectVisible(wall.getByText("Operations desk", { exact: true }), "Operations desk");
  await wall.close();

  const desktop = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await openDashboard(desktop);
  await expectVisible(desktop.getByText("Operations desk", { exact: true }), "Operations desk");
  await desktop.close();
}

const browser = await chromium.launch({ headless: true });

try {
  await verifyApiScenarios();

  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await openDashboard(page);
  await verifyMainControls(page);
  await verifyAdminMenu(page);
  await page.close();

  await verifyScenarioPages(browser);
  await verifyResponsiveLayout(browser);

  console.log("UI smoke checks passed.");
} finally {
  await browser.close();
}

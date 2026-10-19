import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrlArg = process.argv.find((arg) => arg.startsWith("--base-url="));
const BASE_URL =
  baseUrlArg?.slice("--base-url=".length) ??
  process.env.BASE_URL ??
  "http://127.0.0.1:3000";
const manifestUrl = new URL("../src/lib/control-manifest.json", import.meta.url);
const controlManifest = JSON.parse(await readFile(manifestUrl, "utf8"));

function fail(message) {
  throw new Error(message);
}

function logStep(message) {
  console.log(`[ui-smoke] ${message}`);
}

async function expectVisible(locator, label) {
  try {
    await locator.first().waitFor({ state: "visible", timeout: 15000 });
  } catch {
    const count = await locator.count();
    if (count === 0) {
      fail(`Expected visible control or panel "${label}", but it was not found.`);
    }

    for (let index = 0; index < count; index += 1) {
      if (await locator.nth(index).isVisible()) {
        return;
      }
    }

    fail(`Expected visible control or panel "${label}", but it never became visible.`);
  }
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

async function openShowcase(page) {
  logStep("Opening /");
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await expectVisible(
    page.getByRole("heading", { name: "Policy without product is theater.", exact: true }),
    "Policy without product is theater.",
  );
}

async function openWarRoom(page, query = "") {
  logStep(`Opening /war-room${query}`);
  await page.goto(`${BASE_URL}/war-room${query}`, { waitUntil: "domcontentloaded" });
  await expectVisible(page.getByRole("button", { name: "Admin", exact: true }), "Admin");
}

async function fetchJson(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) {
    fail(`Expected ${path} to respond with 200, got ${response.status}.`);
  }

  return response.json();
}

async function verifyBaseUrl() {
  logStep(`Checking base URL ${BASE_URL}`);
  const health = await fetchJson("/api/status");
  if (health?.name !== "Phuket Dashboard") {
    fail(
      `Expected ${BASE_URL} to serve Phuket Dashboard, received ${JSON.stringify(health)}.`,
    );
  }

  const showcase = await fetchJson("/api/showcase");
  if (!Array.isArray(showcase?.scenarios) || showcase.scenarios.length !== 3) {
    fail("Expected showcase API to expose exactly three scenario cards.");
  }
}

async function verifyApiScenarios() {
  logStep("Verifying API scenarios");
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

  // Live demand moves between requests, and a quiet base scales to 0, so
  // "surge > live" is not a stable assertion. The modeled contract is the
  // surge narrative plus a finite non-negative rate.
  if (
    !Number.isFinite(surge.airportDemand.demandRate) ||
    surge.airportDemand.demandRate < 0 ||
    !/hotter than the base day/i.test(surge.airportDemand.summary ?? "")
  ) {
    fail(
      "Tourism surge weekend should expose a finite modeled airport demand rate and the hotter-than-base narrative.",
    );
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
  logStep("Verifying main controls");
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
  logStep("Verifying admin menu");
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
  logStep("Verifying scenario pages");
  for (const scenario of ["tourism-surge-weekend", "red-monsoon-day"]) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await openWarRoom(page, `?scenario=${scenario}`);
    await expectVisible(page.getByText("Operations desk", { exact: true }), "Operations desk");
    await expectVisible(page.getByText("Bus to boat touchpoints", { exact: true }), "Bus to boat touchpoints");
    await expectVisible(page.getByText("MODELED", { exact: true }), "MODELED");
    await page.close();
  }
}

async function verifyShowcase(browser) {
  logStep("Verifying showcase");
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await openShowcase(page);
  await expectVisible(
    page.getByRole("link", { name: "See Live War Room", exact: true }),
    "See Live War Room",
  );
  await expectVisible(
    page.getByText("Deterministic scenario cards", { exact: true }),
    "Deterministic scenario cards",
  );
  await expectVisible(
    page.getByText("Judges should not need live-data luck to understand the product.", {
      exact: true,
    }),
    "Judges should not need live-data luck to understand the product.",
  );

  await page.getByRole("link", { name: "See Live War Room", exact: true }).click();
  await expectVisible(page.getByRole("button", { name: "Admin", exact: true }), "Admin");
  await page.close();
}

async function verifyPhoneGlance(browser) {
  logStep("Verifying phone glance shows four counts at 11px");
  const cases = [
    {
      lang: "en",
      phrases: ["Arrivals in the next 60 minutes", "Buses moving", "Road events", "Boat contacts"],
      stress: ["888/60m", "888 bus", "888 rd", "888 boat"],
    },
    {
      lang: "th",
      phrases: ["ผู้โดยสารถึงใน 60 นาที", "รถโดยสารที่กำลังวิ่ง", "เหตุการณ์บนถนน", "เรือที่ติดต่อได้"],
      stress: ["888/60น", "888 รถ", "888 ถนน", "888 เรือ"],
    },
    {
      lang: "zh",
      phrases: ["未来60分钟进港", "行驶中的巴士", "道路事件", "船舶联系"],
      stress: ["888/60分", "888巴", "888路", "888船"],
    },
  ];

  for (const item of cases) {
    for (const viewport of [
      { width: 360, height: 780 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
    ]) {
      const page = await browser.newPage({ viewport });
      await page.goto(`${BASE_URL}/?lang=${item.lang}`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(
        (needle) => (document.querySelector(".phone-glance")?.getAttribute("aria-label") || "").includes(needle),
        item.phrases[0],
        { timeout: 20000 },
      );
      await page.waitForSelector(".map-kpi-cover", { state: "attached", timeout: 20000 });
      const measured = await page.evaluate((stress) => {
        const glance = document.querySelector(".phone-glance");
        const counts = document.querySelector("[data-glance-counts]");
        const style = getComputedStyle(glance);
        const box = counts.getBoundingClientRect();
        const spans = [...counts.querySelectorAll("span")].map((span) => {
          const rect = span.getBoundingClientRect();
          return rect.width > 0 && rect.left >= box.left - 0.5 && rect.right <= box.right + 0.5;
        });
        const probe = document.createElement("div");
        probe.style.cssText = `position:absolute;visibility:hidden;display:flex;gap:4px;white-space:nowrap;font:${style.font};`;
        for (const token of stress) {
          const span = document.createElement("span");
          span.textContent = token;
          probe.appendChild(span);
        }
        document.body.appendChild(probe);
        const probeW = probe.scrollWidth;
        probe.remove();
        return {
          font: style.fontSize,
          countsSW: counts.scrollWidth,
          countsCW: counts.clientWidth,
          spans,
          probeW,
          header: Math.round(document.querySelector("header.phone-topbar").getBoundingClientRect().height),
          dock: Math.round(document.querySelector("[data-phone-dock]").getBoundingClientRect().height),
          kpi: getComputedStyle(document.querySelector(".map-kpi-cover")).display,
          aria: glance.getAttribute("aria-label") || "",
          title: glance.getAttribute("title") || "",
          htmlLang: document.documentElement.lang,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      }, item.stress);
      if (parseFloat(measured.font) < 11) {
        fail(`${item.lang} ${viewport.width} glance font is ${measured.font}, expected at least 11px.`);
      }
      if (measured.countsSW > measured.countsCW) {
        fail(`${item.lang} ${viewport.width} glance counts overflow ${measured.countsSW}>${measured.countsCW}.`);
      }
      if (measured.spans.length !== 4 || measured.spans.some((visible) => !visible)) {
        fail(`${item.lang} ${viewport.width} glance did not paint all four counts.`);
      }
      if (measured.probeW > measured.countsCW) {
        fail(`${item.lang} ${viewport.width} three-digit glance is ${measured.probeW}px inside ${measured.countsCW}px.`);
      }
      if (measured.header !== 45 || measured.dock !== 56) {
        fail(`${item.lang} ${viewport.width} chrome is header ${measured.header} dock ${measured.dock}.`);
      }
      if (measured.kpi !== "none" || measured.overflow !== 0 || measured.htmlLang !== item.lang) {
        fail(`${item.lang} ${viewport.width} kpi ${measured.kpi} overflow ${measured.overflow} lang ${measured.htmlLang}.`);
      }
      if (measured.title !== measured.aria || item.phrases.some((phrase) => !measured.aria.includes(phrase))) {
        fail(`${item.lang} ${viewport.width} glance aria is missing a qualifier.`);
      }
      await page.getByRole("button", { name: "Brief", exact: true }).click();
      await page.waitForSelector("#phone-intel-sheet");
      const briefText = await page.locator("#phone-intel-sheet").innerText();
      if (item.phrases.some((phrase) => !briefText.includes(phrase))) {
        fail(`${item.lang} ${viewport.width} Brief is missing a qualifier.`);
      }
      const clipped = await page.evaluate(() =>
        [...document.querySelectorAll("#phone-intel-sheet dt")].some((node) => node.scrollWidth > node.clientWidth + 1),
      );
      if (clipped) {
        fail(`${item.lang} ${viewport.width} Brief qualifier is truncated.`);
      }
      await page.keyboard.press("Escape");
      await page.waitForSelector("#phone-intel-sheet", { state: "detached" });
      await page.close();
    }
  }

  const landscape = await browser.newPage({ viewport: { width: 844, height: 390 } });
  await landscape.goto(`${BASE_URL}/?lang=en`, { waitUntil: "domcontentloaded" });
  await landscape.waitForFunction(
    () => (document.querySelector(".phone-glance")?.getAttribute("aria-label") || "").includes("Arrivals in the next 60 minutes"),
  );
  await landscape.waitForSelector(".map-kpi-cover", { state: "attached" });
  const land = await landscape.evaluate(() => ({
    header: Math.round(document.querySelector("header.phone-topbar").getBoundingClientRect().height),
    dock: Math.round(document.querySelector("[data-phone-dock]").getBoundingClientRect().height),
    kpi: getComputedStyle(document.querySelector(".map-kpi-cover")).display,
    font: getComputedStyle(document.querySelector(".phone-glance")).fontSize,
    countsSW: document.querySelector("[data-glance-counts]").scrollWidth,
    countsCW: document.querySelector("[data-glance-counts]").clientWidth,
  }));
  if (land.header !== 45 || land.dock !== 56 || land.kpi !== "none" || parseFloat(land.font) < 11 || land.countsSW > land.countsCW) {
    fail(`Landscape phone chrome changed: ${JSON.stringify(land)}.`);
  }
  await landscape.getByRole("button", { name: "Brief", exact: true }).click();
  await landscape.waitForSelector("#phone-intel-sheet");
  await landscape.goBack();
  await landscape.waitForSelector("#phone-intel-sheet", { state: "detached" });
  if (!landscape.url().includes(new URL(BASE_URL).host)) {
    fail(`Back left the war room: ${landscape.url()}.`);
  }
  await landscape.close();

  for (const viewport of [
    { width: 360, height: 780 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 844, height: 390 },
  ]) {
    const page = await browser.newPage({ viewport });
    await page.goto(`${BASE_URL}/?lang=en`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('button[aria-label="Toggle map legend"]');
    await page.waitForSelector('button[aria-label="Select administrative scope"]');
    await page.waitForSelector('[aria-label^="Map scale"]');
    const boxes = await page.evaluate(() => {
      const rect = (el) => {
        const box = el.getBoundingClientRect();
        return { x: box.x, y: box.y, w: box.width, h: box.height, r: box.right, b: box.bottom };
      };
      const legend = document.querySelector('button[aria-label="Toggle map legend"]');
      const scope = document.querySelector('button[aria-label="Select administrative scope"]');
      const scale = document.querySelector('[aria-label^="Map scale"]');
      return {
        legend: rect(legend),
        scope: rect(scope),
        scale: rect(scale),
        header: Math.round(document.querySelector("header.phone-topbar").getBoundingClientRect().height),
        dock: Math.round(document.querySelector("[data-phone-dock]").getBoundingClientRect().height),
      };
    });
    const hits = (a, b) => a.x < b.r - 0.5 && b.x < a.r - 0.5 && a.y < b.b - 0.5 && b.y < a.b - 0.5;
    if (hits(boxes.legend, boxes.scope) || hits(boxes.legend, boxes.scale) || hits(boxes.scope, boxes.scale)) {
      fail(`${viewport.width} map controls overlap: ${JSON.stringify(boxes)}.`);
    }
    for (const [name, box] of [["legend", boxes.legend], ["scope", boxes.scope]]) {
      if (box.w < 44 || box.h < 44) {
        fail(`${viewport.width} ${name} tap is ${Math.round(box.w)}×${Math.round(box.h)}.`);
      }
    }
    if (boxes.scale.w < 24 || boxes.scale.h < 8) {
      fail(`${viewport.width} scale bar is hidden: ${JSON.stringify(boxes.scale)}.`);
    }
    if (boxes.header !== 45 || boxes.dock !== 56) {
      fail(`${viewport.width} chrome drifted: header ${boxes.header} dock ${boxes.dock}.`);
    }
    await page.close();
  }

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await openWarRoom(desktop);
  await desktop.waitForSelector(".map-kpi-cover", { state: "visible" });
  await desktop.waitForFunction(() => {
    const status = document.querySelector("header [role='status']");
    const label = status?.textContent?.trim() ?? "";
    return label.length > 12 && label !== "Loading";
  });
  const desk = await desktop.evaluate(() => {
    const status = document.querySelector("header [role='status']");
    const chip = status.parentElement;
    const range = document.createRange();
    range.selectNodeContents(status);
    const title = document.querySelector(".phone-war-title");
    const postureWord = [...document.querySelectorAll("header span")].find((node) => node.textContent.trim() === "Posture");
    const admin = [...document.querySelectorAll("header button")].find((node) => node.textContent.trim() === "Admin");
    const legend = document.querySelector('button[aria-label="Toggle map legend"]');
    const scope = document.querySelector('button[aria-label="Select administrative scope"]');
    const size = (el) => {
      const box = el.getBoundingClientRect();
      return { w: Math.round(box.width), h: Math.round(box.height) };
    };
    return {
      header: Math.round(document.querySelector("header").getBoundingClientRect().height),
      titleRow: Math.round(document.querySelector("header").firstElementChild.getBoundingClientRect().height),
      glance: getComputedStyle(document.querySelector(".phone-glance")).display,
      kpi: getComputedStyle(document.querySelector(".map-kpi-cover")).display,
      admin: size(admin),
      legend: size(legend),
      scope: size(scope),
      titleW: Math.round(title.parentElement.getBoundingClientRect().width),
      titleLine: getComputedStyle(title).lineHeight,
      postureX: Math.round(chip.getBoundingClientRect().x),
      postureWordX: Math.round(postureWord.getBoundingClientRect().x),
      postureLines: range.getClientRects().length,
      postureLabel: status.textContent.trim(),
    };
  });
  if (desk.titleRow !== 32 || desk.glance !== "none" || desk.kpi !== "block" || desk.admin.w !== 63 || desk.admin.h !== 24) {
    fail(`Desktop chrome changed: ${JSON.stringify(desk)}.`);
  }
  if (desk.legend.w !== 246 || desk.legend.h !== 28 || desk.scope.w !== 224 || desk.scope.h !== 40) {
    fail(`Desktop map controls changed: ${JSON.stringify(desk)}.`);
  }
  if (desk.postureLines !== 1 || Math.abs(desk.titleW - 145) > 8 || Math.abs(desk.postureWordX - 320) > 6 || Math.abs(desk.postureX - 320) > 16) {
    fail(`Desktop posture drifted from main: ${JSON.stringify(desk)}.`);
  }
  const titleLine = parseFloat(desk.titleLine);
  if (!(titleLine >= 19 && titleLine <= 21)) {
    fail(`Desktop title line-height is ${desk.titleLine}, main is 20px.`);
  }
  await desktop.close();
}

async function verifyResponsiveLayout(browser) {
  logStep("Verifying responsive layout");
  const wall = await browser.newPage({ viewport: { width: 3840, height: 2160 } });
  await openWarRoom(wall);
  await expectVisible(wall.getByText("Phuket operator map", { exact: true }), "Phuket operator map");
  await expectVisible(wall.getByText("Operations desk", { exact: true }), "Operations desk");
  await wall.close();

  const desktop = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await openWarRoom(desktop);
  await expectVisible(desktop.getByText("Operations desk", { exact: true }), "Operations desk");
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 430, height: 932 } });
  await openShowcase(mobile);
  await expectVisible(
    mobile.getByRole("link", { name: "See Live War Room", exact: true }),
    "See Live War Room",
  );
  await mobile.close();
}

const browser = await chromium.launch({ headless: true });

try {
  await verifyBaseUrl();
  await verifyPhoneGlance(browser);
  await verifyApiScenarios();
  await verifyShowcase(browser);

  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await openWarRoom(page);
  await verifyMainControls(page);
  await verifyAdminMenu(page);
  await page.close();

  await verifyScenarioPages(browser);
  await verifyResponsiveLayout(browser);

  console.log("UI smoke checks passed.");
} finally {
  await browser.close();
}

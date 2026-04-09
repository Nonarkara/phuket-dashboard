import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import ShowcaseScrollStory from "../components/Showcase/ShowcaseScrollStory";
import { buildScenarioUrl } from "../lib/client-requests";
import { resolveScenario } from "../lib/scenario";
import { loadShowcasePayload } from "../lib/showcase";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Phuket Dashboard",
  description:
    "Award-facing showcase for Phuket Dashboard: a civic operations product that turns corridor pressure, monsoon risk, tourism demand, and resilience signals into one readable story before handing off to the live war room.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Phuket Dashboard",
    description:
      "A civic operations product that opens with a curated story, then proves it with the live war room.",
    url: "/",
  },
  twitter: {
    title: "Phuket Dashboard",
    description:
      "A civic operations product that opens with a curated story, then proves it with the live war room.",
  },
};

interface HomePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  if (!process.env.NEXT_OUTPUT) {
    const params = await searchParams;
    const requestedScenario =
      typeof params.scenario === "string" ? resolveScenario(params.scenario) : null;

    if (requestedScenario) {
      redirect(
        requestedScenario === "live"
          ? "/war-room"
          : buildScenarioUrl("/war-room", requestedScenario),
      );
    }
  }

  const showcase = await loadShowcasePayload();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Phuket Dashboard",
    applicationCategory: "GovernmentApplication",
    operatingSystem: "Web",
    description: showcase.hero.summary,
    url: "/",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Curated narrative showcase",
      "Live operations war room",
      "Modeled stress scenarios",
      "Corridor-based maritime and weather monitoring",
      "Graceful live-to-fallback resilience",
    ],
  };

  return (
    <>
      <main
        id="main-content"
        tabIndex={-1}
        className="min-h-screen bg-[var(--bg)] text-[var(--ink)]"
      >
        <header className="border-b border-[var(--line)] bg-[var(--panel)] backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--dim)]">
                  Phuket Dashboard
                </div>
                <div className="mt-0.5 text-[13px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
                  Showcase
                </div>
              </div>
              <div className="hidden text-[10px] font-medium tracking-[0.08em] text-[var(--dim)] [font-family:var(--font-mono)] sm:block">
                v7.0
              </div>
            </div>
            <nav
              aria-label="Showcase navigation"
              className="hidden items-center gap-5 text-[12px] text-[var(--muted)] md:flex"
            >
              <Link href="#story" className="hover:text-[var(--ink)]">
                Signature moment
              </Link>
              <Link href="#scenarios" className="hover:text-[var(--ink)]">
                Scenarios
              </Link>
              <Link href="#reliability" className="hover:text-[var(--ink)]">
                Reliability
              </Link>
              <Link
                href={showcase.routes.warRoom}
                className="border border-[var(--cool)] bg-[var(--cool)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-transparent hover:text-[var(--cool)]"
              >
                Open War Room
              </Link>
            </nav>
          </div>
        </header>

        <section className="relative">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-12 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:px-8 lg:py-20">
            <section aria-labelledby="hero-title" className="max-w-3xl">
              <div className="inline-flex border border-[var(--line)] bg-[var(--panel)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.26em] text-[var(--dim)] backdrop-blur-sm">
                {showcase.hero.eyebrow}
              </div>
              <h1
                id="hero-title"
                className="mt-5 max-w-[18ch] text-[clamp(2.4rem,5vw,4rem)] font-semibold leading-[0.94] tracking-[-0.04em] text-[var(--ink)]"
              >
                Policy without product is theater.
              </h1>
              <p className="mt-5 max-w-[62ch] text-[16px] leading-7 text-[var(--muted)]">
                {showcase.hero.summary}
              </p>
              <p className="mt-3 max-w-[54ch] text-[11px] uppercase tracking-[0.18em] text-[var(--dim)]">
                {showcase.hero.title}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={showcase.routes.warRoom}
                  className="border border-[var(--cool)] bg-[var(--cool)] px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white transition-colors hover:bg-transparent hover:text-[var(--cool)]"
                >
                  See Live War Room
                </Link>
                <Link
                  href="#story"
                  className="border border-[var(--line-bright)] px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--ink)] transition-colors hover:border-[var(--ink)]"
                >
                  Watch the signature moment
                </Link>
              </div>
            </section>

            <aside
              aria-label="Showcase metrics"
              className="grid gap-3 self-end sm:grid-cols-2"
            >
              {showcase.hero.metrics.map((metric) => (
                <div
                  key={metric.id}
                  className="dashboard-panel px-5 py-4"
                >
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--dim)]">
                    {metric.label}
                  </div>
                  <div className="mt-2 text-[36px] font-semibold leading-none tracking-[-0.04em] text-[var(--ink)] [font-family:var(--font-mono)]">
                    {metric.value}
                  </div>
                  <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">
                    {metric.detail}
                  </p>
                </div>
              ))}
            </aside>
          </div>
        </section>

        <section
          id="story"
          aria-labelledby="story-title"
          className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-6 lg:px-8 lg:py-20"
        >
          <div className="max-w-3xl">
            <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--dim)]">
              Signature moment
            </div>
            <h2
              id="story-title"
              className="mt-3 text-[clamp(1.8rem,4vw,3rem)] font-semibold leading-[0.96] tracking-[-0.03em] text-[var(--ink)]"
            >
              {showcase.signature.title}
            </h2>
            <p className="mt-4 max-w-[60ch] text-[15px] leading-7 text-[var(--muted)]">
              {showcase.signature.summary}
            </p>
          </div>

          <div className="mt-10">
            <ShowcaseScrollStory
              corridors={showcase.signature.corridors}
              lenses={showcase.signature.lenses}
            />
          </div>
        </section>

        <section
          id="scenarios"
          aria-labelledby="scenarios-title"
          className="border-y border-[var(--line)] bg-[var(--bg-raised)]"
        >
          <div className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-6 lg:px-8 lg:py-20">
            <div className="max-w-3xl">
              <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--dim)]">
                Deterministic scenario cards
              </div>
              <h2
                id="scenarios-title"
                className="mt-3 text-[clamp(1.6rem,3.6vw,2.6rem)] font-semibold leading-[0.98] tracking-[-0.03em] text-[var(--ink)]"
              >
                Judges should not need live-data luck to understand the product.
              </h2>
            </div>

            <div className="mt-10 grid gap-4 xl:grid-cols-3">
              {showcase.scenarios.map((scenario) => (
                <article
                  key={scenario.scenario}
                  className="dashboard-panel px-5 py-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--dim)]">
                        {scenario.kicker}
                      </div>
                      <h3 className="mt-2 text-[20px] font-semibold tracking-[-0.03em] text-[var(--ink)]">
                        {scenario.label}
                      </h3>
                    </div>
                    <div className="border border-[var(--line-bright)] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
                      {scenario.posture}
                    </div>
                  </div>
                  <p className="mt-3 text-[14px] leading-7 text-[var(--muted)]">
                    {scenario.summary}
                  </p>
                  <ul className="mt-4 space-y-2 text-[13px] leading-6 text-[var(--ink)]">
                    {scenario.highlights.map((highlight) => (
                      <li
                        key={highlight}
                        className="border border-[var(--line)] bg-[var(--bg-surface)] px-3 py-2"
                      >
                        {highlight}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={scenario.href}
                    className="mt-5 inline-flex border border-[var(--cool)] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--cool)] transition-colors hover:bg-[var(--cool)] hover:text-white"
                  >
                    Open this scenario live
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="reliability"
          aria-labelledby="reliability-title"
          className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-6 lg:px-8 lg:py-20"
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <section className="dashboard-panel px-5 py-5">
              <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--dim)]">
                Proof of execution
              </div>
              <h2
                id="reliability-title"
                className="mt-3 text-[clamp(1.6rem,3.4vw,2.4rem)] font-semibold leading-[0.98] tracking-[-0.03em] text-[var(--ink)]"
              >
                {showcase.proof.title}
              </h2>
              <p className="mt-3 max-w-[48ch] text-[14px] leading-7 text-[var(--muted)]">
                {showcase.proof.summary}
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {showcase.proof.points.map((point) => (
                  <div
                    key={point.id}
                    className="border border-[var(--line)] bg-[var(--bg-surface)] px-4 py-3"
                  >
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">
                      {point.label}
                    </div>
                    <div className="mt-1.5 text-[20px] font-semibold tracking-[-0.03em] text-[var(--ink)] [font-family:var(--font-mono)]">
                      {point.value}
                    </div>
                    <p className="mt-1.5 text-[12px] leading-5 text-[var(--muted)]">
                      {point.detail}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <aside className="dashboard-panel px-5 py-5">
              <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--dim)]">
                Reliability signals
              </div>
              <h3 className="mt-3 text-[24px] font-semibold leading-[0.98] tracking-[-0.03em] text-[var(--ink)]">
                {showcase.reliability.title}
              </h3>
              <p className="mt-3 text-[14px] leading-7 text-[var(--muted)]">
                {showcase.reliability.summary}
              </p>

              <div className="mt-6 grid gap-3">
                {showcase.reliability.items.map((item) => (
                  <div
                    key={item.id}
                    className="border border-[var(--line)] bg-[var(--bg-surface)] px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--ink)]">
                        {item.label}
                      </div>
                      <div className="border border-[var(--line-bright)] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
                        {item.mode}
                      </div>
                    </div>
                    <p className="mt-2 text-[12px] leading-5 text-[var(--muted)]">
                      {item.detail}
                    </p>
                    <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--dim)] [font-family:var(--font-mono)]">
                      {item.freshnessLabel}
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="border-t border-[var(--line)] bg-[var(--ink)] text-white">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-10 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
            <div className="max-w-3xl">
              <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/50">
                Final handoff
              </div>
              <h2 className="mt-3 text-[clamp(1.6rem,3.6vw,2.6rem)] font-semibold leading-[0.96] tracking-[-0.03em]">
                The showcase explains the system. The war room proves it.
              </h2>
              <p className="mt-3 text-[14px] leading-7 text-white/70">
                Judges land on a controlled story, then step into the actual instrument panel with live, hybrid, and modeled surfaces clearly labeled.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={showcase.routes.warRoom}
                className="border border-white bg-white px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--ink)] transition-colors hover:bg-transparent hover:text-white"
              >
                Enter war room
              </Link>
              {showcase.routes.scenarioLinks.map((link) => (
                <Link
                  key={link.scenario}
                  href={link.href}
                  className="border border-white/20 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/80 transition-colors hover:border-white hover:text-white"
                >
                  {link.scenario.replaceAll("-", " ")}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </>
  );
}

"use client";

import { useCallback, useEffect, useEffectEvent, useId, useRef, useState } from "react";
import {
  Cloud,
  Database,
  Map,
  Network,
  RefreshCw,
  Server,
  X,
} from "lucide-react";
import {
  architectureFlowSteps,
  architectureLayers,
  architectureSections,
  architectureSummary,
  dashboardSurfaces,
  externalProviderCatalog,
  externalProviderCategoryOrder,
  internalApiCatalog,
  internalApiCategoryOrder,
  resiliencePatterns,
  storageNotes,
  type ArchitectureLayerTone,
  type ArchitectureSectionId,
  type ExternalProviderCategory,
  type ExternalProviderDescriptor,
  type InternalApiCategory,
  type InternalApiDescriptor,
} from "../../lib/dashboard-architecture";

interface DashboardArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface StatusPayload {
  status: string;
  version: string;
  signal_strength: number;
  services: Record<string, string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStatusPayload(value: unknown): value is StatusPayload {
  return (
    isRecord(value) &&
    typeof value.status === "string" &&
    typeof value.version === "string" &&
    typeof value.signal_strength === "number" &&
    isRecord(value.services) &&
    Object.values(value.services).every((service) => typeof service === "string")
  );
}

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) {
    return [];
  }

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("disabled"));
}

function prettifyServiceName(value: string) {
  return value
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function toneClasses(tone: ArchitectureLayerTone) {
  switch (tone) {
    case "client":
      return "border-[var(--cool)] bg-[var(--line-bright)] text-[var(--cool)]";
    case "api":
      return "border-[#0ea5e9] bg-[rgba(14,165,233,0.12)] text-[#7dd3fc]";
    case "fusion":
      return "border-[#f59e0b] bg-[rgba(245,158,11,0.12)] text-[#fbbf24]";
    case "storage":
      return "border-[#22c55e] bg-[rgba(34,197,94,0.12)] text-[#4ade80]";
    case "external":
      return "border-[#a855f7] bg-[rgba(168,85,247,0.12)] text-[#c084fc]";
    default:
      return "border-[var(--line-bright)] bg-[var(--line-bright)] text-[var(--cool)]";
  }
}

function groupInternalApis(category: InternalApiCategory) {
  return internalApiCatalog.filter((entry) => entry.category === category);
}

function groupExternalProviders(category: ExternalProviderCategory) {
  return externalProviderCatalog.filter((entry) => entry.category === category);
}

function SummaryCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <article className="dashboard-panel rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--line-bright)] bg-[var(--line-bright)] text-[var(--cool)]">
          {icon}
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
            {label}
          </div>
          <div className="mt-1 text-[24px] font-bold tracking-[-0.03em] text-[var(--ink)]">
            {value}
          </div>
        </div>
      </div>
      <p className="mt-3 text-[12px] leading-5 text-[var(--muted)]">{helper}</p>
    </article>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[var(--line-bright)] bg-[var(--bg-surface)] px-2.5 py-1 text-[10px] font-medium text-[var(--ink)]">
      {children}
    </span>
  );
}

function OverviewTab() {
  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-4">
        <SummaryCard
          icon={<Server size={18} />}
          label="Internal APIs"
          value={String(architectureSummary.internalApiCount)}
          helper="Every browser-facing route is documented here, grouped by domain."
        />
        <SummaryCard
          icon={<Cloud size={18} />}
          label="External Providers"
          value={String(architectureSummary.externalProviderCount)}
          helper="Feeds, tile servers, market data, mobility, optional AI, and media services."
        />
        <SummaryCard
          icon={<Map size={18} />}
          label="UI Surfaces"
          value={String(architectureSummary.uiSurfaceCount)}
          helper="The core operator surfaces that turn normalized signals into decisions."
        />
        <SummaryCard
          icon={<Network size={18} />}
          label="Architecture Layers"
          value={String(architectureSummary.architectureLayerCount)}
          helper="Client, API, fusion, storage, and external provider boundaries."
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="dashboard-panel rounded-2xl p-4 sm:p-5">
          <div className="eyebrow">System Layers</div>
          <div className="mt-4 grid gap-3">
            {architectureLayers.map((layer, index) => (
              <article
                key={layer.id}
                className="rounded-2xl border border-[var(--line)] bg-[rgba(10,15,26,0.72)] p-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                    L{index + 1}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${toneClasses(layer.tone)}`}
                  >
                    {layer.tone}
                  </span>
                  <h3 className="text-[14px] font-semibold text-[var(--ink)]">
                    {layer.title}
                  </h3>
                </div>
                <p className="mt-3 text-[13px] leading-6 text-[var(--ink)]">
                  {layer.summary}
                </p>
                <div className="mt-3 space-y-2">
                  {layer.bullets.map((bullet) => (
                    <p
                      key={`${layer.id}-${bullet}`}
                      className="rounded-xl border border-[var(--line)] bg-[var(--bg-raised)] px-3 py-2 text-[12px] leading-5 text-[var(--muted)]"
                    >
                      {bullet}
                    </p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="dashboard-panel rounded-2xl p-4 sm:p-5">
          <div className="eyebrow">Operator Surfaces</div>
          <div className="mt-4 space-y-3">
            {dashboardSurfaces.map((surface) => (
              <article
                key={surface.id}
                className="rounded-2xl border border-[var(--line)] bg-[rgba(10,15,26,0.72)] px-4 py-3"
              >
                <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--ink)]">
                  {surface.title}
                </h3>
                <p className="mt-2 text-[12px] leading-5 text-[var(--muted)]">
                  {surface.summary}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function FlowTab() {
  return (
    <div className="space-y-5">
      <section className="dashboard-panel rounded-2xl p-4 sm:p-5">
        <div className="eyebrow">Signal Pipeline</div>
        <div className="mt-4 space-y-3">
          {architectureFlowSteps.map((step, index) => (
            <article key={step.id} className="rounded-2xl border border-[var(--line)] bg-[rgba(10,15,26,0.72)] p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line-bright)] bg-[var(--line-bright)] text-[11px] font-bold text-[var(--cool)]">
                  {index + 1}
                </span>
                <h3 className="text-[14px] font-semibold text-[var(--ink)]">
                  {step.title}
                </h3>
              </div>
              <p className="mt-3 text-[13px] leading-6 text-[var(--ink)]">
                {step.summary}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {step.outputs.map((output) => (
                  <Pill key={`${step.id}-${output}`}>{output}</Pill>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="dashboard-panel rounded-2xl p-4 sm:p-5">
          <div className="eyebrow">Resilience Rules</div>
          <div className="mt-4 space-y-3">
            {resiliencePatterns.map((pattern) => (
              <p
                key={pattern}
                className="rounded-2xl border border-[var(--line)] bg-[rgba(10,15,26,0.72)] px-4 py-3 text-[12px] leading-5 text-[var(--muted)]"
              >
                {pattern}
              </p>
            ))}
          </div>
        </div>

        <div className="dashboard-panel rounded-2xl p-4 sm:p-5">
          <div className="eyebrow">Storage Notes</div>
          <div className="mt-4 space-y-3">
            {storageNotes.map((note) => (
              <p
                key={note}
                className="rounded-2xl border border-[var(--line)] bg-[rgba(10,15,26,0.72)] px-4 py-3 text-[12px] leading-5 text-[var(--muted)]"
              >
                {note}
              </p>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function InternalApiCard({ entry }: { entry: InternalApiDescriptor }) {
  return (
    <article className="rounded-2xl border border-[var(--line)] bg-[rgba(10,15,26,0.72)] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <code className="rounded-lg border border-[var(--line-bright)] bg-[var(--bg-raised)] px-2.5 py-1.5 text-[12px] text-[var(--ink)]">
          GET {entry.path}
        </code>
        <span className="rounded-full border border-[var(--line-bright)] bg-[var(--line-bright)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--cool)]">
          {entry.category}
        </span>
      </div>
      <p className="mt-3 text-[13px] leading-6 text-[var(--ink)]">{entry.purpose}</p>
      <div className="mt-4 space-y-3 text-[12px] leading-5 text-[var(--muted)]">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
            Consumed by
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {entry.consumers.map((consumer) => (
              <Pill key={`${entry.path}-${consumer}`}>{consumer}</Pill>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
            Upstreams
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {entry.upstreams.map((upstream) => (
              <Pill key={`${entry.path}-${upstream}`}>{upstream}</Pill>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
            Fallback
          </div>
          <p className="mt-2">{entry.fallback}</p>
        </div>
      </div>
    </article>
  );
}

function InternalApisTab() {
  return (
    <div className="space-y-5">
      {internalApiCategoryOrder.map((category) => {
        const entries = groupInternalApis(category);

        return (
          <section key={category} className="dashboard-panel rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="eyebrow">{category}</div>
                <h2 className="mt-1 text-[20px] font-bold tracking-[-0.03em] text-[var(--ink)]">
                  {category} APIs
                </h2>
              </div>
              <div className="rounded-full border border-[var(--line-bright)] bg-[var(--bg-surface)] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--muted)]">
                {entries.length} routes
              </div>
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {entries.map((entry) => (
                <InternalApiCard key={entry.path} entry={entry} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ExternalProviderCard({ entry }: { entry: ExternalProviderDescriptor }) {
  return (
    <article className="rounded-2xl border border-[var(--line)] bg-[rgba(10,15,26,0.72)] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-[14px] font-semibold text-[var(--ink)]">{entry.label}</h3>
        <span className="rounded-full border border-[var(--line-bright)] bg-[var(--line-bright)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--cool)]">
          {entry.category}
        </span>
        {entry.optional ? (
          <span className="rounded-full border border-[rgba(245,158,11,0.18)] bg-[rgba(245,158,11,0.12)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#f59e0b]">
            Optional
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-[13px] leading-6 text-[var(--ink)]">{entry.description}</p>
      <div className="mt-4 space-y-3 text-[12px] leading-5 text-[var(--muted)]">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
            Used by
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {entry.surfaces.map((surface) => (
              <Pill key={`${entry.id}-${surface}`}>{surface}</Pill>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
            Endpoints
          </div>
          <div className="mt-2 space-y-2">
            {entry.endpoints.map((endpoint) => (
              <code
                key={`${entry.id}-${endpoint}`}
                className="block overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--bg-raised)] px-3 py-2 text-[11px] text-[var(--ink)]"
              >
                {endpoint}
              </code>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function ExternalProvidersTab() {
  return (
    <div className="space-y-5">
      {externalProviderCategoryOrder.map((category) => {
        const entries = groupExternalProviders(category);

        return (
          <section key={category} className="dashboard-panel rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="eyebrow">{category}</div>
                <h2 className="mt-1 text-[20px] font-bold tracking-[-0.03em] text-[var(--ink)]">
                  {category} Providers
                </h2>
              </div>
              <div className="rounded-full border border-[var(--line-bright)] bg-[var(--bg-surface)] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--muted)]">
                {entries.length} services
              </div>
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {entries.map((entry) => (
                <ExternalProviderCard key={entry.id} entry={entry} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function RuntimeTab({
  statusPayload,
  isRefreshing,
  onRefresh,
}: {
  statusPayload: StatusPayload | null;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-5">
      <section className="dashboard-panel rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="eyebrow">Live Runtime Status</div>
            <h2 className="mt-1 text-[20px] font-bold tracking-[-0.03em] text-[var(--ink)]">
              Service posture
            </h2>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--line-bright)] bg-[var(--bg-surface)] px-4 py-2 text-[12px] font-semibold text-[var(--ink)] transition-colors hover:border-[var(--line-bright)] hover:text-[var(--cool)]"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
            Refresh status
          </button>
        </div>

        {statusPayload ? (
          <>
            <div className="mt-4 grid gap-4 xl:grid-cols-3">
              <SummaryCard
                icon={<Network size={18} />}
                label="Runtime status"
                value={statusPayload.status}
                helper={`Version ${statusPayload.version} with signal strength ${statusPayload.signal_strength.toFixed(2)}.`}
              />
              <SummaryCard
                icon={<Database size={18} />}
                label="Optional providers"
                value={String(architectureSummary.optionalProviderCount)}
                helper="Mapbox and OpenAI are optional enrichers, not hard dependencies."
              />
              <SummaryCard
                icon={<Server size={18} />}
                label="Service flags"
                value={String(Object.keys(statusPayload.services).length)}
                helper="These flags reflect current environment configuration rather than provider liveness."
              />
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {Object.entries(statusPayload.services).map(([serviceName, state]) => (
                <article
                  key={serviceName}
                  className="rounded-2xl border border-[var(--line)] bg-[rgba(10,15,26,0.72)] p-4"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-[14px] font-semibold text-[var(--ink)]">
                      {prettifyServiceName(serviceName)}
                    </h3>
                    <span className="rounded-full border border-[var(--line-bright)] bg-[var(--line-bright)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--cool)]">
                      {state}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[rgba(10,15,26,0.72)] px-4 py-3 text-[12px] leading-5 text-[var(--muted)]">
            Runtime status has not loaded yet. Use refresh to query `/api/status`.
          </div>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="dashboard-panel rounded-2xl p-4 sm:p-5">
          <div className="eyebrow">Persistence and Cache</div>
          <div className="mt-4 space-y-3">
            {storageNotes.map((note) => (
              <p
                key={note}
                className="rounded-2xl border border-[var(--line)] bg-[rgba(10,15,26,0.72)] px-4 py-3 text-[12px] leading-5 text-[var(--muted)]"
              >
                {note}
              </p>
            ))}
          </div>
        </div>

        <div className="dashboard-panel rounded-2xl p-4 sm:p-5">
          <div className="eyebrow">Failover Posture</div>
          <div className="mt-4 space-y-3">
            {resiliencePatterns.map((pattern) => (
              <p
                key={pattern}
                className="rounded-2xl border border-[var(--line)] bg-[rgba(10,15,26,0.72)] px-4 py-3 text-[12px] leading-5 text-[var(--muted)]"
              >
                {pattern}
              </p>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function renderActiveSection(
  section: ArchitectureSectionId,
  statusPayload: StatusPayload | null,
  isRefreshing: boolean,
  onRefresh: () => void,
) {
  switch (section) {
    case "overview":
      return <OverviewTab />;
    case "flow":
      return <FlowTab />;
    case "internal-apis":
      return <InternalApisTab />;
    case "external-providers":
      return <ExternalProvidersTab />;
    case "runtime":
      return (
        <RuntimeTab
          statusPayload={statusPayload}
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
        />
      );
    default:
      return null;
  }
}

export default function DashboardArchitectureModal({
  isOpen,
  onClose,
}: DashboardArchitectureModalProps) {
  const [activeSection, setActiveSection] =
    useState<ArchitectureSectionId>("overview");
  const [statusPayload, setStatusPayload] = useState<StatusPayload | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/status");
      const payload: unknown = await response.json();

      if (isStatusPayload(payload)) {
        setStatusPayload(payload);
      }
    } catch {
      // Keep the last known status payload if refresh fails.
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const handleClose = () => {
    setActiveSection("overview");
    onClose();
  };
  const closeArchitectureFromEffect = useEffectEvent(() => {
    handleClose();
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusHandle = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeArchitectureFromEffect();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements(dialogRef.current);
      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      if (!activeElement || !dialogRef.current?.contains(activeElement)) {
        event.preventDefault();
        firstElement.focus();
        return;
      }

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusHandle);
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const initialLoad = setTimeout(() => {
      setIsRefreshing(true);
      void loadStatus();
    }, 0);

    return () => {
      clearTimeout(initialLoad);
    };
  }, [isOpen, loadStatus]);

  if (!isOpen) {
    return null;
  }

  const activeSectionMeta =
    architectureSections.find((section) => section.id === activeSection) ??
    architectureSections[0];

  return (
    <div
      className="fixed inset-0 z-[125] flex items-end justify-center bg-[rgba(2,6,23,0.86)] p-0 sm:items-center sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="dashboard-panel-strong flex h-[100dvh] w-full flex-col rounded-none border-[var(--line-bright)] sm:h-auto sm:max-h-[calc(100dvh-3rem)] sm:max-w-[min(1380px,100%)] sm:rounded-[28px]"
      >
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--cool)]">
              <Network size={14} />
              APIs And System Architecture
            </div>
            <h2
              id={titleId}
              className="mt-2 text-[22px] font-bold tracking-[-0.03em] text-[var(--ink)] sm:text-[28px]"
            >
              {activeSectionMeta.label}
            </h2>
            <p
              id={descriptionId}
              className="mt-1 max-w-4xl text-[12px] leading-5 text-[var(--muted)] sm:text-[13px]"
            >
              {activeSectionMeta.description}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-full border border-[var(--line-bright)] bg-[var(--bg-surface)] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--muted)]">
              {architectureSummary.internalApiCount} APIs / {architectureSummary.externalProviderCount} providers
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={handleClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line-bright)] bg-[var(--bg-surface)] text-[var(--ink)] transition-colors hover:border-[var(--line-bright)] hover:text-[var(--cool)]"
              aria-label="Close architecture reference"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 py-4 sm:px-6 sm:py-6 lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
          <nav
            aria-label="Architecture sections"
            className="order-2 flex gap-2 overflow-x-auto pb-1 lg:order-1 lg:flex-col lg:overflow-y-auto lg:pb-0"
          >
            {architectureSections.map((section) => {
              const isActive = section.id === activeSection;

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`min-w-[220px] rounded-2xl border px-4 py-3 text-left transition-colors lg:min-w-0 ${
                    isActive
                      ? "border-[var(--cool)] bg-[var(--line-bright)]"
                      : "border-[var(--line)] bg-[var(--bg-surface)] hover:border-[var(--line-bright)]"
                  }`}
                >
                  <div className="text-[13px] font-semibold text-[var(--ink)]">
                    {section.label}
                  </div>
                  <div className="mt-1 text-[11px] leading-4 text-[var(--muted)]">
                    {section.description}
                  </div>
                </button>
              );
            })}
          </nav>

          <div className="order-1 min-h-0 overflow-y-auto pr-1 lg:order-2">
            {renderActiveSection(
              activeSection,
              statusPayload,
              isRefreshing,
              () => {
                setIsRefreshing(true);
                void loadStatus();
              },
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

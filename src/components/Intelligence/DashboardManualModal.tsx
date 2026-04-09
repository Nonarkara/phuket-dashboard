"use client";

import Image from "next/image";
import { assetPath } from "../../lib/asset-path";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  dashboardManualPages,
  type ManualPage,
} from "../../lib/dashboard-manual";

interface DashboardManualModalProps {
  isOpen: boolean;
  onClose: () => void;
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

function renderPageNumber(index: number) {
  return String(index + 1).padStart(2, "0");
}

function ManualTextPanel({ page }: { page: ManualPage }) {
  return (
    <div className="flex min-h-0 flex-col gap-4">
      <section className="dashboard-panel rounded-2xl p-4 sm:p-5">
        <div className="eyebrow">How To Read This Page</div>
        <ul className="mt-3 space-y-3 text-[12px] leading-5 text-[var(--ink)] sm:text-[13px]">
          {page.bullets.map((bullet) => (
            <li
              key={bullet}
              className="rounded-xl border border-[var(--line)] bg-[var(--bg-surface)] px-3 py-2.5"
            >
              {bullet}
            </li>
          ))}
        </ul>
      </section>

      <section className="dashboard-panel rounded-2xl p-4 sm:p-5">
        <div className="eyebrow">Callouts</div>
        <div className="mt-3 space-y-3">
          {page.callouts.map((callout, index) => (
            <article
              key={`${page.id}-${callout.label}`}
              className="rounded-xl border border-[var(--line)] bg-[var(--bg-surface)] px-3 py-3"
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-[var(--line-bright)] bg-[var(--line-bright)] text-[11px] font-bold text-[var(--cool)]">
                  {index + 1}
                </span>
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--ink)]">
                  {callout.label}
                </h3>
              </div>
              <p className="mt-2 text-[12px] leading-5 text-[var(--muted)] sm:text-[13px]">
                {callout.description}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function DashboardManualModal({
  isOpen,
  onClose,
}: DashboardManualModalProps) {
  const [activePage, setActivePage] = useState(0);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const lastIndex = dashboardManualPages.length - 1;

  const handleClose = () => {
    setActivePage(0);
    onClose();
  };
  const closeManualFromEffect = useEffectEvent(() => {
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
        closeManualFromEffect();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setActivePage((current) => Math.min(current + 1, lastIndex));
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActivePage((current) => Math.max(current - 1, 0));
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
  }, [isOpen, lastIndex]);

  if (!isOpen) {
    return null;
  }

  const page = dashboardManualPages[activePage];

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-[rgba(2,6,23,0.82)] p-0 sm:items-center sm:p-6"
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
        className="dashboard-panel-strong flex h-[100dvh] w-full flex-col rounded-none border-[var(--line-bright)] sm:h-auto sm:max-h-[calc(100dvh-3rem)] sm:max-w-[min(1220px,100%)] sm:rounded-[28px]"
      >
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--cool)]">
              <BookOpen size={14} />
              Operator Manual
            </div>
            <h2
              id={titleId}
              className="mt-2 text-[22px] font-bold tracking-[-0.03em] text-[var(--ink)] sm:text-[28px]"
            >
              {page.title}
            </h2>
            <p
              id={descriptionId}
              className="mt-1 max-w-3xl text-[12px] leading-5 text-[var(--muted)] sm:text-[13px]"
            >
              {page.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-full border border-[var(--line-bright)] bg-[var(--bg-surface)] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--muted)]">
              Page {renderPageNumber(activePage)} / {renderPageNumber(lastIndex)}
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={handleClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line-bright)] bg-[var(--bg-surface)] text-[var(--ink)] transition-colors hover:border-[var(--line-bright)] hover:text-[var(--cool)]"
              aria-label="Close dashboard manual"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 py-4 sm:px-6 sm:py-6 lg:grid lg:grid-cols-[240px_minmax(0,1fr)_320px]">
          <nav
            aria-label="Manual pages"
            className="order-2 flex gap-2 overflow-x-auto pb-1 lg:order-1 lg:flex-col lg:overflow-y-auto lg:pb-0"
          >
            {dashboardManualPages.map((candidate, index) => {
              const isActive = index === activePage;

              return (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => setActivePage(index)}
                  aria-current={isActive ? "page" : undefined}
                  className={`min-w-[220px] rounded-2xl border px-4 py-3 text-left transition-colors lg:min-w-0 ${
                    isActive
                      ? "border-[var(--cool)] bg-[var(--line-bright)]"
                      : "border-[var(--line)] bg-[var(--bg-surface)] hover:border-[var(--line-bright)]"
                  }`}
                >
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                    {renderPageNumber(index)}
                  </div>
                  <div className="mt-1 text-[13px] font-semibold text-[var(--ink)]">
                    {candidate.title}
                  </div>
                  <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--muted)]">
                    {candidate.subtitle}
                  </div>
                </button>
              );
            })}
          </nav>

          <figure className="order-1 flex min-h-0 flex-col lg:order-2">
            <div className="dashboard-panel flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[24px] border-[var(--line-bright)] p-3 sm:p-4">
              <Image
                src={assetPath(page.imageSrc)}
                alt={page.imageAlt}
                width={1600}
                height={1200}
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="max-h-full w-full rounded-[20px] border border-[var(--line)] object-contain shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
              />
            </div>
            <figcaption className="mt-3 text-[11px] leading-5 text-[var(--muted)] sm:text-[12px]">
              Annotated live dashboard capture. Refresh these images whenever the
              layout or panel roles materially change.
            </figcaption>
          </figure>

          <aside className="order-3 min-h-0 overflow-y-auto">
            <ManualTextPanel page={page} />
          </aside>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => setActivePage((current) => Math.max(current - 1, 0))}
            disabled={activePage === 0}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--line-bright)] bg-[var(--bg-surface)] px-4 py-2 text-[12px] font-semibold text-[var(--ink)] transition-colors hover:border-[var(--line-bright)] hover:text-[var(--cool)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={14} />
            Previous
          </button>

          <div className="text-center">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--cool)]">
              Manual Navigation
            </div>
            <div className="mt-1 text-[12px] text-[var(--muted)]">
              Use the page list, arrow keys, or the buttons below.
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActivePage((current) => Math.min(current + 1, lastIndex))}
            disabled={activePage === lastIndex}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--line-bright)] bg-[var(--bg-surface)] px-4 py-2 text-[12px] font-semibold text-[var(--ink)] transition-colors hover:border-[var(--line-bright)] hover:text-[var(--cool)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ChevronRight size={14} />
          </button>
        </footer>
      </section>
    </div>
  );
}

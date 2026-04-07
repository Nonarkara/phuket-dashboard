"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJson, isAbortError } from "../lib/client-requests";
import type {
  ModuleApiResponse,
  ModuleDataState,
  ModuleMetadata,
} from "../types/modules";

/**
 * Hook to fetch and poll data for a specific module.
 *
 * Usage:
 *   const { data, loading, error, tier } = useModuleData<FireEvent[]>("nasa-firms");
 */
export function useModuleData<T = unknown>(
  moduleId: string | null,
): ModuleDataState<T> & { meta: ModuleMetadata | null } {
  const [state, setState] = useState<ModuleDataState<T>>({
    data: null,
    loading: true,
    error: null,
    lastFetchedAt: null,
    tier: null,
  });
  const [meta, setMeta] = useState<ModuleMetadata | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const fetchModule = useCallback(async () => {
    if (!moduleId) {
      return;
    }

    const requestId = ++requestIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const json = await fetchJson<ModuleApiResponse<T>>(`/api/modules/${moduleId}`, {
        signal: controller.signal,
      });
      if (controller.signal.aborted || requestId !== requestIdRef.current) {
        return;
      }

      setState({
        data: json.data,
        loading: false,
        error: null,
        lastFetchedAt: json.fetchedAt,
        tier: json.tier,
      });
      setMeta(json.module);
    } catch (err: unknown) {
      if (isAbortError(err) || requestId !== requestIdRef.current) {
        return;
      }

      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Fetch failed",
      }));
    }
  }, [moduleId]);

  useEffect(() => {
    abortRef.current?.abort();
    requestIdRef.current += 1;

    if (!moduleId) {
      setState({
        data: null,
        loading: false,
        error: null,
        lastFetchedAt: null,
        tier: null,
      });
      setMeta(null);
      return;
    }

    setMeta(null);
    setState({
      data: null,
      loading: true,
      error: null,
      lastFetchedAt: null,
      tier: null,
    });
    void fetchModule();

    return () => {
      requestIdRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [moduleId, fetchModule]);

  // Set up polling once we have metadata with pollInterval
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (meta && meta.pollInterval > 0 && moduleId) {
      intervalRef.current = setInterval(
        () => void fetchModule(),
        meta.pollInterval * 1000,
      );
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [meta, moduleId, fetchModule]);

  return { ...state, meta };
}

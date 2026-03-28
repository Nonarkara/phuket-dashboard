import type { GovernorScenarioId } from "../types/dashboard";

export function resolveScenario(value?: string | null): GovernorScenarioId {
  if (
    value === "red-monsoon-day" ||
    value === "tourism-surge-weekend" ||
    value === "stable-recovery-day"
  ) {
    return value;
  }

  return "live";
}


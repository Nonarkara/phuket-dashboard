/**
 * Phuket — canonical metrics from the Smart City Thailand Index (SCITI / SLIC).
 *
 * Mirrored from `slic-index/v3-current/src/thailandData.ts` (Phuket province
 * entry). Single source of truth: when SCITI updates, we update here.
 *
 * SCITI does not publish tourism arrival counts or visitor-origin rankings —
 * those remain in the dashboard's own data layer (TAT / World Bank etc.).
 */

export const PHUKET_SCITI = {
  province: "Phuket",
  region: "South",
  populationThousands: 418,
  gppPerCapitaBaht: 385_000,
  avgMonthlyIncomeBaht: 35_200,
  pm25AnnualUgM3: 18.2,
  hospitalBedsPer10k: 24,
  crimeRatePer100k: 310,
  greenCoveragePct: 32,
} as const;

export type PhuketSciti = typeof PHUKET_SCITI;

/** Compact one-liner suitable for citation in press drafts and footers. */
export function phuketSlugLine(): string {
  const popK = PHUKET_SCITI.populationThousands;
  const gpp = (PHUKET_SCITI.gppPerCapitaBaht / 1000).toFixed(0);
  return `Phuket Province · pop ${popK}k · GPP ฿${gpp}k/capita · avg income ฿${(PHUKET_SCITI.avgMonthlyIncomeBaht / 1000).toFixed(1)}k/mo`;
}

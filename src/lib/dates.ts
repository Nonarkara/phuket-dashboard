export function toIsoOrNull(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const gdeltMatch =
    trimmed.match(/^(\d{4})(\d{2})(\d{2})$/) ??
    trimmed.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?$/);

  const normalized = gdeltMatch
    ? `${gdeltMatch[1]}-${gdeltMatch[2]}-${gdeltMatch[3]}T${gdeltMatch[4] ?? "00"}:${gdeltMatch[5] ?? "00"}:${gdeltMatch[6] ?? "00"}Z`
    : trimmed;

  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

export function formatMoney(cents: number | null | undefined, currency = "USD") {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatNumber(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: n >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(n);
}

export function formatPercent(rate: number | null | undefined) {
  if (rate == null) return "—";
  const value = rate > 1 ? rate : rate * 100;
  return `${value.toFixed(1)}%`;
}

export function statusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

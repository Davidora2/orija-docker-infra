type CapacityRingColors = {
  track?: string;
  used?: string;
  over?: string;
  text?: string;
};

type CapacityRingProps = {
  used?: number | null;
  planned?: number | null;
  capacity?: number | null;
  available?: number | null;
  size?: number;
  label?: string;
  colors?: CapacityRingColors;
};

function safeAmount(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
}

export function CapacityRing({
  used,
  planned,
  capacity,
  available,
  size = 112,
  label = "Capacity used",
  colors = {},
}: CapacityRingProps) {
  const usedValue = safeAmount(used ?? planned);
  const capacityValue = safeAmount(capacity ?? available);
  const ratio =
    capacityValue > 0 ? usedValue / capacityValue : usedValue > 0 ? 1 : 0;
  const overCapacity = usedValue > capacityValue && usedValue > 0;
  const percentage = Math.round(ratio * 100);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(ratio, 1);
  const strokeDashoffset = circumference * (1 - progress);
  const displayValue =
    capacityValue <= 0 && usedValue > 0 ? "Over" : `${percentage}%`;
  const description = `${label}: ${usedValue.toFixed(1)} of ${capacityValue.toFixed(
    1,
  )}${overCapacity ? ", over capacity" : ""}`;

  return (
    <figure
      className="relative m-0 inline-flex shrink-0 items-center justify-center"
      style={{ height: size, width: size }}
      aria-label={description}
      role="img"
    >
      <svg
        aria-hidden="true"
        className="-rotate-90"
        height={size}
        viewBox="0 0 100 100"
        width={size}
      >
        <circle
          cx="50"
          cy="50"
          fill="none"
          r={radius}
          stroke={colors.track ?? "#e5e9e3"}
          strokeWidth="9"
        />
        <circle
          cx="50"
          cy="50"
          fill="none"
          r={radius}
          stroke={
            overCapacity
              ? colors.over ?? "#c9634f"
              : colors.used ?? "#617a57"
          }
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          strokeWidth="9"
        />
      </svg>
      <span
        aria-hidden="true"
        className="absolute text-center font-serif text-lg leading-none"
        style={{ color: colors.text ?? "#14241f" }}
      >
        {displayValue}
      </span>
    </figure>
  );
}

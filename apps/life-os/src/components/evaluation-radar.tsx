import {
  EVALUATION_DIMENSIONS,
  clampEvaluationScore,
  evaluationRadarPoints,
  type EvaluationScores,
} from "@life-os/shared";

export function EvaluationRadar({
  scores,
  label = "Idea evaluation scores",
}: {
  scores: EvaluationScores;
  label?: string;
}) {
  const guide = "60,22 98,60 60,98 22,60";

  return (
    <figure
      className="rounded-2xl border border-[#dde2dd] bg-[#f7f8f5] p-4"
      aria-label={label}
    >
      <div className="mx-auto max-w-[18rem]">
        <svg viewBox="0 0 120 120" role="img" aria-label={label}>
          {[0.25, 0.5, 0.75, 1].map((scale) => {
            const r = 38 * scale;
            return (
              <polygon
                key={scale}
                points={`60,${60 - r} ${60 + r},60 60,${60 + r} ${60 - r},60`}
                fill="none"
                stroke="#cdd6ca"
                strokeWidth="0.8"
              />
            );
          })}
          <polygon points={guide} fill="none" stroke="#cdd6ca" strokeWidth="0.8" />
          <path d="M60 20V100M20 60H100" stroke="#cdd6ca" strokeWidth="0.8" />
          <polygon
            points={evaluationRadarPoints(scores)}
            fill="#617a57"
            fillOpacity="0.28"
            stroke="#3f5937"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <text x="60" y="10" textAnchor="middle" className="fill-[#14241f] text-[7px]">
            Impact
          </text>
          <text x="116" y="62" textAnchor="end" className="fill-[#14241f] text-[7px]">
            Effort
          </text>
          <text x="60" y="116" textAnchor="middle" className="fill-[#14241f] text-[7px]">
            Alignment
          </text>
          <text x="4" y="62" className="fill-[#14241f] text-[7px]">
            Timing
          </text>
        </svg>
      </div>
      <figcaption className="mt-2 grid grid-cols-2 gap-2 text-xs">
        {EVALUATION_DIMENSIONS.map(({ key, label: dimensionLabel }) => (
          <span
            key={key}
            className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5"
          >
            <span className="text-[#6c7771]">{dimensionLabel}</span>
            <strong className="text-[#14241f]">
              {clampEvaluationScore(scores[key])}/10
            </strong>
          </span>
        ))}
      </figcaption>
      <p className="mt-2 text-xs leading-relaxed text-[#6c7771]">
        Each axis shows its raw score. Effort is not inverted or combined.
      </p>
    </figure>
  );
}

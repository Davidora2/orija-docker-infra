import { FocusHero } from "./focus-hero";

type LandscapeHeroProps = {
  title: string;
  subtitle: string;
  detail: string;
  eyebrow?: string;
};

export function LandscapeHero({
  title,
  subtitle,
  detail,
  eyebrow = "Life OS · Plan",
}: LandscapeHeroProps) {
  return (
    <FocusHero
      accentDot
      eyebrow={eyebrow}
      hills
      meta={detail}
      subtitle={subtitle}
      title={title}
    />
  );
}

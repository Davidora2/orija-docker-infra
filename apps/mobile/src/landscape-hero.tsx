import { FocusHero } from './ui';

export function LandscapeHero({
  title,
  subtitle,
  detail,
  eyebrow = 'Life OS · Plan',
}: {
  title: string;
  subtitle: string;
  detail: string;
  eyebrow?: string;
}) {
  return (
    <FocusHero
      accentDot
      eyebrow={eyebrow}
      meta={detail}
      subtitle={subtitle}
      title={title}
    />
  );
}

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { LifeIcon } from './life-icon';
import {
  PRIORITY_QUADRANT_META,
  actionPriorityQuadrant,
} from './priority-matrix';
import type { LifeItem } from './api';
import { bodyNumber, bodyString } from './life-data';
import {
  AcidButtonLabel,
  AppButton,
  FocusHero,
  FocusHeroHours,
} from './ui';

function hours(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}h`;
}

function tap() {
  if (Platform.OS !== 'web') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

function actionContext(
  action: LifeItem,
  projects: LifeItem[],
  pillars: LifeItem[],
) {
  const project = projects.find((row) => row.id === action.parentId);
  const area = project
    ? pillars.find((row) => row.id === project.parentId)
    : undefined;
  const label = [area?.title, project?.title].filter(Boolean).join(' · ');
  return { project, area, label };
}

function metadataLine(
  action: LifeItem,
  projects: LifeItem[],
  pillars: LifeItem[],
) {
  const { project, label } = actionContext(action, projects, pillars);
  const quadrant =
    PRIORITY_QUADRANT_META[
      actionPriorityQuadrant(action.body, project?.body)
    ].title;
  const day = bodyString(action, 'day');
  return [day, label, quadrant, action.status === 'DONE' ? 'Done' : '']
    .filter(Boolean)
    .join(' · ');
}

type TodayPrimaryHeroProps = {
  primary: LifeItem;
  projects: LifeItem[];
  pillars: LifeItem[];
  busy?: boolean;
  onToggle: () => void;
  onViewCapacity: () => void;
};

export function TodayPrimaryHero({
  primary,
  projects,
  pillars,
  busy,
  onToggle,
  onViewCapacity,
}: TodayPrimaryHeroProps) {
  const done = primary.status === 'DONE';
  const meta = metadataLine(primary, projects, pillars);

  return (
    <FocusHero
      accentDot
      eyebrow="Primary move"
      meta={meta}
      title={primary.title}
      trailing={<FocusHeroHours>{hours(bodyNumber(primary, 'hours', 1))}</FocusHeroHours>}
      actions={
        <>
          <AppButton
            accessibilityLabel={done ? 'Undo complete' : 'Mark done'}
            disabled={busy}
            onPress={() => {
              tap();
              onToggle();
            }}
            variant="acid"
          >
            <AcidButtonLabel icon={<LifeIcon color="#2F431E" name="done" size={16} />}>
              {done ? 'Undo complete' : 'Mark done'}
            </AcidButtonLabel>
          </AppButton>
          <AppButton
            accessibilityLabel="View capacity"
            onPress={() => {
              tap();
              onViewCapacity();
            }}
            variant="outlineDark"
          >
            View capacity
          </AppButton>
        </>
      }
      style={done ? { opacity: 0.98 } : undefined}
    />
  );
}

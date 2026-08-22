import {
  type AreasPlanSummary,
  type IdeasPlanSummary,
  type ProjectsPlanSummary,
} from '@life-os/plan-domain';
import { StyleSheet, Text, View } from 'react-native';
import { CapacityRing } from './capacity-ring';

type PlanSummaryStripProps =
  | {
      segment: 'areas';
      summary: AreasPlanSummary;
      variant?: 'dark' | 'cream';
    }
  | {
      segment: 'projects';
      summary: ProjectsPlanSummary;
      variant?: 'dark' | 'cream';
    }
  | {
      segment: 'ideas';
      summary: IdeasPlanSummary;
      variant?: 'dark' | 'cream';
    };

const colors = {
  ink: '#14241F',
  canvas: '#F4F5F0',
  paper: '#FFFFFF',
  line: '#DDE2DD',
  muted: '#A8B5A3',
  acid: '#D6F57A',
  danger: '#F2A08F',
};

export function PlanSummaryStrip(props: PlanSummaryStripProps) {
  const { summary } = props;
  const dark = props.variant !== 'cream';
  const showRing =
    props.segment !== 'ideas' &&
    'availableHours' in summary &&
    summary.availableHours > 0 &&
    summary.plannedHours >= 0;

  return (
    <View
      accessibilityLabel={`${summary.line}. ${summary.stateLabel}`}
      style={[styles.strip, dark ? styles.stripDark : styles.stripCream]}
    >
      {showRing ? (
        <CapacityRing
          available={summary.availableHours}
          planned={summary.plannedHours}
          size={52}
          label="Weekly capacity"
          colors={{
            track: dark ? 'rgba(255,255,255,0.16)' : '#E5E9E3',
            used: dark ? colors.acid : '#617A57',
            over: colors.danger,
            text: dark ? colors.canvas : colors.ink,
          }}
        />
      ) : null}
      <View style={styles.copy}>
        <Text
          numberOfLines={2}
          style={[styles.line, dark ? styles.lineDark : styles.lineCream]}
        >
          {summary.line}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.state, dark ? styles.stateDark : styles.stateCream]}
        >
          {summary.stateLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    maxHeight: 120,
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  stripDark: {
    backgroundColor: colors.ink,
    borderColor: '#2A3D36',
  },
  stripCream: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  line: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  lineDark: {
    color: colors.canvas,
  },
  lineCream: {
    color: colors.ink,
  },
  state: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  stateDark: {
    color: colors.muted,
  },
  stateCream: {
    color: '#6C7771',
  },
});

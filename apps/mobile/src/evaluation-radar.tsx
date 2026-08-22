import {
  EVALUATION_DIMENSIONS,
  clampEvaluationScore,
  evaluationRadarPoints,
  type EvaluationScores,
} from '@life-os/shared';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polygon, Text as SvgText } from 'react-native-svg';

export function EvaluationRadar({
  scores,
  label = 'Idea evaluation scores',
}: {
  scores: EvaluationScores;
  label?: string;
}) {
  return (
    <View style={styles.wrap} accessible accessibilityLabel={label}>
      <Svg
        width="100%"
        height={220}
        viewBox="0 0 120 120"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {[0.25, 0.5, 0.75, 1].map((scale) => {
          const radius = 38 * scale;
          return (
            <Polygon
              key={scale}
              points={`60,${60 - radius} ${60 + radius},60 60,${60 + radius} ${60 - radius},60`}
              fill="none"
              stroke="#CDD6CA"
              strokeWidth={0.8}
            />
          );
        })}
        <Line x1="60" y1="20" x2="60" y2="100" stroke="#CDD6CA" strokeWidth={0.8} />
        <Line x1="20" y1="60" x2="100" y2="60" stroke="#CDD6CA" strokeWidth={0.8} />
        <Polygon
          points={evaluationRadarPoints(scores)}
          fill="#617A57"
          fillOpacity={0.28}
          stroke="#3F5937"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <SvgText x="60" y="10" textAnchor="middle" fontSize="7" fill="#14241F">
          Impact
        </SvgText>
        <SvgText x="116" y="62" textAnchor="end" fontSize="7" fill="#14241F">
          Effort
        </SvgText>
        <SvgText x="60" y="116" textAnchor="middle" fontSize="7" fill="#14241F">
          Alignment
        </SvgText>
        <SvgText x="4" y="62" fontSize="7" fill="#14241F">
          Timing
        </SvgText>
      </Svg>
      <View style={styles.legend}>
        {EVALUATION_DIMENSIONS.map(({ key, label: dimensionLabel }) => (
          <View key={key} style={styles.legendItem}>
            <Text style={styles.legendLabel}>{dimensionLabel}</Text>
            <Text style={styles.legendValue}>
              {clampEvaluationScore(scores[key])}/10
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.note}>
        Each axis shows its raw score. Effort is not inverted or combined.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#F7F8F5',
    borderColor: '#DDE2DD',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  legendItem: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    flexBasis: '47%',
    flexDirection: 'row',
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  legendLabel: { color: '#6C7771', fontSize: 12 },
  legendValue: { color: '#14241F', fontSize: 12, fontWeight: '700' },
  note: { color: '#6C7771', fontSize: 12, lineHeight: 17, marginTop: 10 },
});

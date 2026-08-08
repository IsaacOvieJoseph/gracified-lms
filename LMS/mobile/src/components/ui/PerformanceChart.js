import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { formatPct } from '../../utils/reportExport';

export default function PerformanceChart({ title = 'Performance Analytics', data = [] }) {
  const { theme } = useTheme();

  if (!data || data.length === 0) return null;

  const getScoreColor = (score) => {
    const val = Number(score) || 0;
    if (val >= 80) return '#10b981'; // Green
    if (val >= 60) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  };

  // Calculate grade distribution
  let excellentCount = 0;
  let goodCount = 0;
  let needsImprovementCount = 0;

  data.forEach((item) => {
    const score = Number(item.score ?? item.averagePercentage ?? item.overallAverage ?? item.avgScore ?? 0);
    if (score >= 80) excellentCount++;
    else if (score >= 60) goodCount++;
    else needsImprovementCount++;
  });

  const total = data.length;
  const excellentPct = Math.round((excellentCount / total) * 100);
  const goodPct = Math.round((goodCount / total) * 100);
  const needsPct = Math.round((needsImprovementCount / total) * 100);

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.chartTitle, { color: theme.text }]}>{title}</Text>

      {/* Visual Distribution Segmented Bar */}
      <View style={styles.segmentContainer}>
        <View style={styles.segmentLabelRow}>
          <Text style={[styles.segmentLabel, { color: theme.muted }]}>Grade Distribution</Text>
          <Text style={[styles.segmentSubLabel, { color: theme.muted }]}>{total} Items</Text>
        </View>

        <View style={[styles.segmentBarBg, { backgroundColor: theme.border }]}>
          {excellentPct > 0 && <View style={[styles.segmentChunk, { width: `${excellentPct}%`, backgroundColor: '#10b981' }]} />}
          {goodPct > 0 && <View style={[styles.segmentChunk, { width: `${goodPct}%`, backgroundColor: '#f59e0b' }]} />}
          {needsPct > 0 && <View style={[styles.segmentChunk, { width: `${needsPct}%`, backgroundColor: '#ef4444' }]} />}
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: '#10b981' }]} />
            <Text style={[styles.legendText, { color: theme.muted }]}>≥80% ({excellentCount})</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: '#f59e0b' }]} />
            <Text style={[styles.legendText, { color: theme.muted }]}>60-79% ({goodCount})</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: '#ef4444' }]} />
            <Text style={[styles.legendText, { color: theme.muted }]}>&lt;60% ({needsImprovementCount})</Text>
          </View>
        </View>
      </View>

      {/* Bar Chart Bars */}
      <Text style={[styles.barsHeading, { color: theme.text }]}>Score Breakdown</Text>
      <View style={styles.barsList}>
        {data.map((item, idx) => {
          const name = item.name || item.className || item.title || `Item ${idx + 1}`;
          const rawScore = Number(item.score ?? item.averagePercentage ?? item.overallAverage ?? item.avgScore ?? 0);
          const scoreFormatted = formatPct(rawScore);
          const color = getScoreColor(rawScore);

          return (
            <View key={item.id || item._id || idx} style={styles.barItemRow}>
              <View style={styles.barLabelCol}>
                <Text style={[styles.barName, { color: theme.text }]} numberOfLines={1}>
                  {name}
                </Text>
              </View>

              <View style={styles.barTrackCol}>
                <View style={[styles.barBg, { backgroundColor: theme.border }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${Math.min(Math.max(rawScore, 4), 100)}%`,
                        backgroundColor: color,
                      },
                    ]}
                  />
                </View>
              </View>

              <Text style={[styles.barValText, { color: color }]}>{scoreFormatted}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginVertical: 4,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  segmentContainer: {
    marginBottom: 16,
  },
  segmentLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  segmentLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  segmentSubLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  segmentBarBg: {
    height: 10,
    borderRadius: 5,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  segmentChunk: {
    height: '100%',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '600',
  },
  barsHeading: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  barsList: {
    gap: 10,
  },
  barItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barLabelCol: {
    width: 95,
  },
  barName: {
    fontSize: 12,
    fontWeight: '700',
  },
  barTrackCol: {
    flex: 1,
  },
  barBg: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  barValText: {
    width: 48,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '800',
  },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const normalizeMcqText = (value) => String(value ?? '').trim();

export const getMcqAnswerState = (studentAnswer, correctOption) => {
  const selected = normalizeMcqText(studentAnswer);
  const correct = normalizeMcqText(correctOption);
  const hasAnswer = selected.length > 0;
  const isCorrect = hasAnswer && correct.length > 0 && selected === correct;
  const isWrongOrMissed = !isCorrect; // wrong selection or blank
  return { selected, correct, hasAnswer, isCorrect, isWrongOrMissed };
};

/**
 * Renders MCQ options with review colors:
 * - Selected + correct → green
 * - Selected + wrong → red
 * - Correct key (when student missed/wrong/blank) → green
 * - Other options → muted
 */
export default function McqReviewOptions({ options = [], correctOption, studentAnswer, theme }) {
  const { selected, correct, hasAnswer } = getMcqAnswerState(studentAnswer, correctOption);

  if (!Array.isArray(options) || options.length === 0) {
    const state = getMcqAnswerState(studentAnswer, correctOption);
    return (
      <View style={[styles.summaryBox, {
        backgroundColor: state.isCorrect ? `${theme.success}14` : `${theme.danger}14`,
        borderColor: state.isCorrect ? theme.success : theme.danger,
      }]}>
        <Text style={[styles.summaryLabel, { color: theme.muted }]}>Student answer</Text>
        <Text style={[styles.summaryText, { color: state.isCorrect ? theme.success : theme.danger }]}>
          {state.hasAnswer ? state.selected : 'No answer submitted'}
        </Text>
        {state.correct ? (
          <Text style={[styles.keyText, { color: theme.success }]}>Correct: {state.correct}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {options.map((opt, oIdx) => {
        const optionText = normalizeMcqText(opt);
        const isCorrect = correct.length > 0 && optionText === correct;
        const isSelected = hasAnswer && optionText === selected;
        const isWrongSelection = isSelected && !isCorrect;

        let borderColor = 'transparent';
        let backgroundColor = 'transparent';
        let iconName = 'ellipse-outline';
        let iconColor = theme.muted;
        let textColor = theme.muted;
        let label = '';

        if (isSelected && isCorrect) {
          borderColor = theme.success;
          backgroundColor = `${theme.success}14`;
          iconName = 'checkmark-circle';
          iconColor = theme.success;
          textColor = theme.success;
          label = ' (Correct)';
        } else if (isWrongSelection) {
          borderColor = theme.danger;
          backgroundColor = `${theme.danger}14`;
          iconName = 'close-circle';
          iconColor = theme.danger;
          textColor = theme.danger;
          label = ' (Your answer)';
        } else if (isCorrect) {
          // Show the key in green when student missed it (wrong or blank)
          borderColor = theme.success;
          backgroundColor = `${theme.success}10`;
          iconName = 'checkmark-circle-outline';
          iconColor = theme.success;
          textColor = theme.success;
          label = hasAnswer ? ' (Correct)' : ' (Correct — missed)';
        }

        return (
          <View
            key={`${oIdx}-${optionText}`}
            style={[styles.optionRow, { borderColor, backgroundColor }]}
          >
            <Ionicons name={iconName} size={18} color={iconColor} />
            <Text style={[styles.optionText, { color: textColor }, (isCorrect || isSelected) && { fontWeight: '700' }]}>
              {opt}{label}
            </Text>
          </View>
        );
      })}

      {!hasAnswer && (
        <View style={[styles.missedBanner, { backgroundColor: `${theme.danger}14`, borderColor: theme.danger }]}>
          <Ionicons name="alert-circle-outline" size={16} color={theme.danger} />
          <Text style={[styles.missedText, { color: theme.danger }]}>No answer submitted</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8, marginTop: 8 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionText: { fontSize: 14, flex: 1 },
  missedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  missedText: { fontSize: 12, fontWeight: '700' },
  summaryBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  summaryLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  summaryText: { fontSize: 14, fontWeight: '600' },
  keyText: { fontSize: 12, fontWeight: '600', marginTop: 4 },
});

/**
 * SM-2 Spaced Repetition Algorithm
 *
 * This implements the SuperMemo 2 algorithm for optimal review scheduling.
 * Quality ratings:
 *   0-2: Incorrect/failed (resets interval)
 *   3: Correct but hard (minimum progress)
 *   4: Correct with some hesitation
 *   5: Perfect recall
 */

export interface SM2Result {
  newInterval: number;
  newEaseFactor: number;
  nextReviewAt: number;
}

/**
 * Calculate next review interval based on SM-2 algorithm
 * @param quality - Rating 0-5 (0-2 = incorrect, 3-5 = correct with varying ease)
 * @param easeFactor - Current ease factor (default 2.5)
 * @param interval - Current interval in days
 * @param repetitions - Number of successful repetitions
 */
export function calculateNextReview(
  quality: number,
  easeFactor: number,
  interval: number,
  repetitions: number
): SM2Result {
  let newEaseFactor = easeFactor;
  let newInterval = interval;

  if (quality < 3) {
    // Incorrect answer - reset
    newInterval = 1;
  } else {
    // Correct answer - increase interval
    if (repetitions === 0) {
      newInterval = 1;
    } else if (repetitions === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * easeFactor);
    }

    // Update ease factor
    newEaseFactor = Math.max(
      1.3,
      easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    );
  }

  // Calculate next review timestamp (interval is in days)
  const nextReviewAt = Date.now() + newInterval * 24 * 60 * 60 * 1000;

  return { newInterval, newEaseFactor, nextReviewAt };
}

/**
 * Convert quality rating (0-5) to mastery percentage change
 * @param quality - Rating 0-5
 * @param currentMastery - Current mastery percentage (0-100)
 */
export function qualityToMastery(quality: number, currentMastery: number): number {
  if (quality >= 4) {
    return Math.min(100, currentMastery + 15);
  } else if (quality === 3) {
    return Math.min(100, currentMastery + 5);
  } else if (quality === 2) {
    return Math.max(0, currentMastery - 5);
  } else {
    return Math.max(0, currentMastery - 15);
  }
}

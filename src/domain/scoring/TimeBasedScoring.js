'use strict';

/**
 * Strategy: points = round(1000 × remainingMs / (questionTime × 1000))
 * Identical to MindBuzz scoring. Incorrect answers always yield 0.
 */
class TimeBasedScoring {
  calculate({ isCorrect, questionTimeSeconds, elapsedMs }) {
    if (!isCorrect) return 0;
    const totalMs = questionTimeSeconds * 1000;
    const remainingMs = Math.max(0, totalMs - elapsedMs);
    return Math.round((1000 * remainingMs) / totalMs);
  }
}

module.exports = TimeBasedScoring;

/**
 * notification_app_fe/src/utils/priority.js
 * ===========================================
 * Priority scoring logic — JavaScript port of the Python Stage 1 algorithm.
 *
 * Formula (identical to backend):
 *   score = TYPE_WEIGHT[type] × 1,000,000,000 + unix_timestamp_seconds
 *
 * The large multiplier ensures the type dimension always dominates; the
 * timestamp acts as a tie-breaker so newer notifications of the same type
 * rank above older ones.
 */

// ---------------------------------------------------------------------------
// Weight table — must stay in sync with notification_app_be/priority_inbox.py
// ---------------------------------------------------------------------------

/**
 * Numeric weights assigned to each notification type.
 * Higher weight = higher priority in the inbox.
 *
 * @type {Record<string, number>}
 */
export const TYPE_WEIGHT = {
  Placement: 3,   // career-critical
  Result:    2,   // academic
  Event:     1,   // informational
};

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Compute the priority score for a single notification.
 *
 * @param {{ Type: string, Timestamp: string }} notification - Raw API object.
 * @returns {number} Numeric score — higher means higher priority.
 */
export function computeScore(notification) {
  const weight = TYPE_WEIGHT[notification.Type] ?? 0;

  // The API returns timestamps with a space separator ("2026-04-22 17:51:30").
  // Replace space with 'T' so the Date constructor parses it correctly.
  const ts = new Date(notification.Timestamp.replace(' ', 'T')).getTime() / 1000;

  return weight * 1_000_000_000 + ts;
}

// ---------------------------------------------------------------------------
// Top-N selection
// ---------------------------------------------------------------------------

/**
 * Return the top-N notifications sorted by descending priority score.
 *
 * For typical inbox sizes (N = 5–30) a full sort is adequate.
 * A proper max-heap (like the Python backend) would be preferable for
 * very large notification streams, but is unnecessary in the browser context
 * where the dataset is bounded by the API response.
 *
 * @param {Array<object>} notifications - Full list of raw notification objects.
 * @param {number}        n             - How many to return (default: 10).
 * @returns {Array<object>} Top-N notifications with an added `_score` field.
 */
export function getTopN(notifications, n = 10) {
  // Augment each notification with its pre-computed score to avoid
  // recomputing during the sort comparator.
  const scored = notifications.map(notif => ({
    ...notif,
    _score: computeScore(notif),
  }));

  // Sort descending by score (highest priority first)
  scored.sort((a, b) => b._score - a._score);

  // Return only the top N entries
  return scored.slice(0, n);
}

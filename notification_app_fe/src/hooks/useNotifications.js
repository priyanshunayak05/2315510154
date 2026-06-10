/**
 * notification_app_fe/src/hooks/useNotifications.js
 * ===================================================
 * Custom React hook — central state manager for all notification data.
 *
 * Responsibilities:
 *   - Fetch notifications from the API (with pagination + type filtering).
 *   - Compute the priority-ranked top-N list via the scoring utility.
 *   - Track viewed/unread state, persisted to localStorage so it survives
 *     page refreshes.
 *   - Expose helpers: markViewed, markAllViewed, refresh.
 *
 * All side-effects and API calls are logged through the Logging Middleware.
 *
 * @returns {object} Notification state and control functions — see bottom of file.
 */
/**
 * notification_app_fe/src/hooks/useNotifications.js
 * ===================================================
 * Custom React hook — central state manager for all notification data.
 *
 * Responsibilities:
 *   - Fetch notifications from the Evaluation API whenever the type filter
 *     or topN value changes.
 *   - Derive the priority-ranked top-N list via the scoring utility.
 *   - Track viewed/unread state in localStorage so it survives page refreshes.
 *   - Expose helpers: markViewed, markAllViewed, refresh.
 *
 * All side-effects and API calls are logged through the Logging Middleware
 * (getLogger('hook') → POSTs to the evaluation log server).
 *
 * @returns {object} Notification state and control functions — see return
 *                   statement at the bottom of the hook for full API.
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchNotifications } from '../utils/api';
import { getTopN }            from '../utils/priority';
import { getLogger }          from '../utils/logger';

/** Module-scoped logger — all log lines will show [hook] as the source package. */
const log = getLogger('hook');

// ---------------------------------------------------------------------------
// localStorage helpers — persist viewed-ID set across page refreshes
// ---------------------------------------------------------------------------

/** localStorage key used to store the set of viewed notification IDs. */
const VIEWED_KEY = 'campus_notifications_viewed_ids';

/**
 * Load the persisted set of viewed notification IDs from localStorage.
 * Returns an empty Set when nothing is stored or when JSON parsing fails.
 *
 * @returns {Set<string>} Set of notification ID strings already seen by the user.
 */
function loadViewedIds() {
  try {
    const raw = localStorage.getItem(VIEWED_KEY);
    return new Set(JSON.parse(raw || '[]'));
  } catch {
    log.warn('Failed to parse viewed IDs from localStorage — resetting to empty set');
    return new Set();
  }
}

/**
 * Persist the current set of viewed IDs to localStorage.
 * Silently warns (via the logger) if the write fails due to quota limits.
 *
 * @param {Set<string>} set - The updated set of viewed notification IDs.
 */
function saveViewedIds(set) {
  try {
    localStorage.setItem(VIEWED_KEY, JSON.stringify([...set]));
  } catch {
    log.warn('Could not persist viewed IDs to localStorage (quota exceeded?)');
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export default function useNotifications() {
  /** Full list of notifications returned by the most recent API fetch. */
  const [allNotifications, setAllNotifications] = useState([]);

  /** True while a fetch request is in flight. */
  const [loading, setLoading] = useState(false);

  /** Error message string when the last fetch failed; null otherwise. */
  const [error, setError] = useState(null);

  /** Currently active notification type filter ('All' | 'Placement' | 'Result' | 'Event'). */
  const [typeFilter, setTypeFilter] = useState('All');

  /** How many top-priority notifications to show in the Priority Inbox tab. */
  const [topN, setTopN] = useState(10);

  /**
   * Set of notification IDs the user has already opened/read.
   * Initialised from localStorage so read state persists across refreshes.
   */
  const [viewedIds, setViewedIds] = useState(loadViewedIds);

  /** Timestamp of the last successful fetch, shown in the header. Null before first fetch. */
  const [lastFetched, setLastFetched] = useState(null);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  /**
   * Fetch notifications from the API and update local state.
   *
   * Wrapped in useCallback so its reference is stable across renders.
   * Re-created (and therefore re-triggered via useEffect) only when
   * typeFilter or topN changes.
   *
   * On success : updates allNotifications and lastFetched.
   * On failure : sets a user-friendly error message via setError.
   * Always     : clears the loading flag in the finally block.
   */
  const load = useCallback(async () => {
    log.info(`Fetching notifications | typeFilter=${typeFilter} topN=${topN}`);
    setLoading(true);
    setError(null);

    try {
      const data = await fetchNotifications({
        notification_type: typeFilter !== 'All' ? typeFilter : undefined,
      });
      setAllNotifications(data);
      setLastFetched(new Date());
      log.info(`Successfully loaded ${data.length} notification(s)`);
    } catch (err) {
      // Surface a user-friendly message without leaking internal details
      const message =
        err?.response?.data?.message || err.message || 'Failed to fetch notifications';
      log.error(`Fetch failed: ${message}`);
      setError(message);
    } finally {
      // Always clear the loading spinner whether the fetch succeeded or failed
      setLoading(false);
    }
  }, [typeFilter, topN]);

  /**
   * Trigger a fresh fetch whenever typeFilter or topN changes.
   * Also runs once on mount to populate the initial notification list.
   */
  useEffect(() => { load(); }, [load]);

  // -------------------------------------------------------------------------
  // Viewed state management
  // -------------------------------------------------------------------------

  /**
   * Mark a single notification as read.
   * Adds the ID to the viewedIds set and immediately persists to localStorage.
   *
   * @param {string} id - UUID of the notification to mark as read.
   */
  const markViewed = useCallback((id) => {
    log.debug(`Marking viewed: ${id}`);
    setViewedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      saveViewedIds(next);
      return next;
    });
  }, []);

  /**
   * Mark ALL currently loaded notifications as read in one operation.
   * Used by the "Mark all read" button in the header.
   * Persists the updated set to localStorage immediately.
   */
  const markAllViewed = useCallback(() => {
    log.info('Marking all visible notifications as viewed');
    setViewedIds(prev => {
      const next = new Set(prev);
      allNotifications.forEach(n => next.add(n.ID));
      saveViewedIds(next);
      return next;
    });
  }, [allNotifications]);

  // -------------------------------------------------------------------------
  // Derived values (computed each render, not stored in state)
  // -------------------------------------------------------------------------

  /**
   * Top-N notifications ranked by priority score (type weight + timestamp).
   * Recomputed whenever allNotifications or topN changes.
   */
  const priorityNotifications = getTopN(allNotifications, topN);

  /**
   * Count of notifications the user has not yet opened.
   * Drives the unread badge and StatsBar display.
   */
  const unreadCount = allNotifications.filter(n => !viewedIds.has(n.ID)).length;

  // -------------------------------------------------------------------------
  // Public API of the hook
  // -------------------------------------------------------------------------
  return {
    allNotifications,      // Array<object>  — full fetched list
    priorityNotifications, // Array<object>  — top-N ranked subset
    loading,               // boolean        — true while fetching
    error,                 // string | null  — error message or null
    typeFilter,            // string         — active type filter
    setTypeFilter,         // (string) => void — change type filter
    topN,                  // number         — current top-N value
    setTopN,               // (number) => void — change top-N
    viewedIds,             // Set<string>    — IDs marked as read
    markViewed,            // (id) => void   — mark one as read
    markAllViewed,         // () => void     — mark all as read
    refresh: load,         // () => void     — manual re-fetch
    lastFetched,           // Date | null    — timestamp of last fetch
    unreadCount,           // number         — unread notification count
  };
}
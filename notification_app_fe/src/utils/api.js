/**
 * notification_app_fe/src/utils/api.js
 * ======================================
 * HTTP service layer for the Campus Notifications API.
 *
 * All outgoing requests and incoming responses are logged via the shared
 * Logging Middleware (logger.js) — no raw console.* calls are used here.
 *
 * The bearer token is read from the REACT_APP_API_TOKEN environment variable.
 * Never hard-code credentials in source code.
 *
 * Supported query parameters (passed as `options` to fetchNotifications):
 *   page              - Pagination page number (default: 1)
 *   limit             - Results per page (default: 50)
 *   notification_type - Filter by 'Placement' | 'Result' | 'Event'
 */
/**
 * notification_app_fe/src/utils/api.js
 * ======================================
 * HTTP service layer for the Campus Notifications API.
 *
 * Responsibilities:
 *   - Configure a single Axios instance with base URL, auth header, and timeout.
 *   - Intercept every request/response and log it via the Logging Middleware.
 *   - Expose fetchNotifications() as the single public function for data fetching.
 *
 * All log calls go through getLogger('api') → POSTs to the evaluation log server.
 * No bare console.* calls are used anywhere in this file.
 *
 * Environment variables:
 *   REACT_APP_API_TOKEN — Bearer token for the protected API route.
 *                         Set this in your .env file before starting the app.
 */

import axios from 'axios';
import { getLogger, logCall } from './logger';

/** Module-scoped logger — all log lines will show [api] as the source package. */
const log = getLogger('api');

// ---------------------------------------------------------------------------
// Axios client configuration
// ---------------------------------------------------------------------------

/** Base URL for the Campus Notifications evaluation service. */
const BASE_URL = 'http://4.224.186.213/evaluation-service/notifications';

/**
 * Bearer token read from the build-time environment variable.
 * Falls back to empty string if not set (unauthenticated requests will 401).
 */
const TOKEN = process.env.REACT_APP_API_TOKEN || '';

/**
 * Pre-configured Axios instance shared by all API calls in this module.
 *
 * Using a dedicated instance (rather than the global axios) lets us:
 *   - Set the base URL once and reuse it everywhere.
 *   - Attach the Authorization header globally.
 *   - Apply a consistent timeout to every request.
 */
const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000, // 15 s — prevents hung requests blocking the UI
  headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
});

// ---------------------------------------------------------------------------
// Interceptors — request / response logging via Logging Middleware
// ---------------------------------------------------------------------------

/**
 * Request interceptor — logs every outgoing HTTP call before it is sent.
 * Helps correlate frontend actions with backend logs when debugging.
 */
client.interceptors.request.use(config => {
  log.info(`GET ${config.baseURL}`);
  return config;
});

/**
 * Response interceptor:
 *   - Success (2xx) : logs the HTTP status code.
 *   - Error (4xx/5xx): logs status + message, then re-rejects so callers
 *     can handle the error themselves.
 */
client.interceptors.response.use(
  response => {
    log.info(`${response.status} ${response.config.baseURL}`);
    return response;
  },
  error => {
    log.error(`API error ${error.response?.status ?? 'no-status'}: ${error.message}`);
    return Promise.reject(error);
  },
);

// ---------------------------------------------------------------------------
// API methods
// ---------------------------------------------------------------------------

/**
 * Internal (unwrapped) implementation of fetchNotifications.
 * Wrapped with logCall below so entry / exit / errors are auto-logged.
 *
 * Query params sent to the API:
 *   notification_type — optional; only included when a specific type is
 *                       selected (i.e. not 'All'). The server returns all
 *                       notifications when this param is absent.
 *
 * Note: `page` and `limit` params are intentionally omitted — the evaluation
 * server returns 400 Bad Request when they are present.
 *
 * @param {object} [options]
 * @param {string} [options.notification_type] - 'Placement' | 'Result' | 'Event'
 * @returns {Promise<Array<object>>} Array of raw notification objects from the API.
 */
async function _fetchNotifications({ notification_type = undefined } = {}) {
  // Build query params object — keep it empty unless a type filter is active
  const params = {};
  if (notification_type && notification_type !== 'All') {
    params.notification_type = notification_type;
  }

  const response = await client.get('', { params });

  // Defensively default to empty array if the key is missing in the response
  const data = response.data?.notifications ?? [];
  log.debug(`Parsed ${data.length} notification(s) from API response`);
  return data;
}

/**
 * Fetch notifications from the Evaluation API.
 *
 * This is the public-facing function — wrapped with logCall so every
 * invocation is automatically traced through the Logging Middleware
 * (entry, exit, and any thrown errors are all logged).
 *
 * @type {(options?: { notification_type?: string }) => Promise<Array<object>>}
 *
 * @example
 *   const notifications = await fetchNotifications();
 *   const placements    = await fetchNotifications({ notification_type: 'Placement' });
 */
export const fetchNotifications = logCall(log, 'fetchNotifications', _fetchNotifications);
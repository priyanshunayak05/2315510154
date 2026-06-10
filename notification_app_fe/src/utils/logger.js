/**
 * notification_app_fe/src/utils/logger.js
 * =========================================
 * Frontend Logging Middleware
 *
 * Mirrors the backend logger.py contract:
 *   - Structured, levelled output (DEBUG / INFO / WARN / ERROR)
 *   - Timestamped, module-namespaced log lines
 *   - @log_call equivalent via the `logCall` higher-order function
 *
 * Rules:
 *   - All modules MUST obtain a logger via getLogger() — no bare console.*
 *   - In production builds (NODE_ENV=production) only WARN+ messages emit.
 *
 * Usage:
 *   import { getLogger, logCall } from '../utils/logger';
 *
 *   const log = getLogger('MyComponent');
 *   log.info('Component mounted');
 *
 *   const safeFetch = logCall(log, 'fetchData', fetchData);
 */

// ---------------------------------------------------------------------------
// Level constants — numeric so comparisons are cheap
// ---------------------------------------------------------------------------
const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };

// Suppress DEBUG/INFO in production to keep browser consoles clean
const ACTIVE_LEVEL =
  process.env.NODE_ENV === 'production' ? LEVELS.WARN : LEVELS.DEBUG;

// ANSI-style CSS for browser DevTools colour coding
const STYLES = {
  DEBUG: 'color:#22d3ee;font-weight:600',  // cyan
  INFO:  'color:#4ade80;font-weight:600',  // green
  WARN:  'color:#facc15;font-weight:600',  // amber
  ERROR: 'color:#f87171;font-weight:600',  // red
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return current time formatted as "YYYY-MM-DD HH:MM:SS". */
function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

// ---------------------------------------------------------------------------
// Logger factory
// ---------------------------------------------------------------------------

/**
 * Create a named logger instance with structured output.
 *
 * @param {string} module - Logical name shown in every log line (e.g. 'App', 'api').
 * @returns {{ debug, info, warn, error }} Logger object.
 */
function createLogger(module) {
  /**
   * Internal emit function — checks active level then delegates to console.
   *
   * @param {'DEBUG'|'INFO'|'WARN'|'ERROR'} level
   * @param {...*} args - Additional values to log alongside the message.
   */
  function emit(level, ...args) {
    if (LEVELS[level] < ACTIVE_LEVEL) return; // below threshold — suppress

    const prefix = `%c[${timestamp()}] ${level.padEnd(5)} [${module}]`;

    /* eslint-disable no-console */
    switch (level) {
      case 'DEBUG': console.debug(prefix, STYLES[level], ...args); break;
      case 'INFO':  console.info(prefix,  STYLES[level], ...args); break;
      case 'WARN':  console.warn(prefix,  STYLES[level], ...args); break;
      case 'ERROR': console.error(prefix, STYLES[level], ...args); break;
      default:      console.log(prefix,   STYLES[level], ...args);
    }
    /* eslint-enable no-console */
  }

  return {
    debug: (...a) => emit('DEBUG', ...a),
    info:  (...a) => emit('INFO',  ...a),
    warn:  (...a) => emit('WARN',  ...a),
    error: (...a) => emit('ERROR', ...a),
  };
}

/**
 * Public factory — call once per module.
 *
 * @param {string} module - Module/component name for log prefix.
 * @returns {object} Logger instance.
 */
export function getLogger(module) {
  return createLogger(module);
}

// ---------------------------------------------------------------------------
// Decorator-style HOF (mirrors Python @log_call)
// ---------------------------------------------------------------------------

/**
 * Wrap an async function with automatic entry / exit / error logging.
 *
 * Mirrors the backend @log_call decorator in logger.py.
 *
 * @param {object}   logger - Logger instance from getLogger().
 * @param {string}   fnName - Display name used in log messages.
 * @param {Function} fn     - Async function to wrap.
 * @returns {Function} Wrapped async function with identical signature.
 *
 * @example
 *   const safeFetch = logCall(log, 'fetchNotifications', fetchNotifications);
 *   const data = await safeFetch({ limit: 50 });
 */
export function logCall(logger, fnName, fn) {
  return async (...args) => {
    logger.debug(`→ ${fnName}()`, ...args);
    try {
      const result = await fn(...args);
      logger.debug(`← ${fnName}() resolved`);
      return result;
    } catch (err) {
      logger.error(`✖ ${fnName}() threw`, err);
      throw err; // always re-throw so callers can handle the error
    }
  };
}

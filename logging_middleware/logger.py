"""
logging_middleware/logger.py
============================
Centralised Logging Middleware for the Campus Notifications platform.

Provides:
  - StructuredFormatter  : coloured, timestamped log lines
  - get_logger(name)     : factory that returns a configured Logger instance
  - log_call(logger)     : decorator that traces function entry / exit / errors

Usage:
    from logging_middleware.logger import get_logger, log_call

    log = get_logger("my_module")
    log.info("Server started")

    @log_call(log)
    def fetch_data(): ...

Rules:
  - All application code MUST use this middleware instead of bare print() or
    the built-in logging.basicConfig().
  - Each module should obtain its own named logger via get_logger(__name__).
"""

import logging
import sys
from datetime import datetime
from functools import wraps


# ---------------------------------------------------------------------------
# Formatter
# ---------------------------------------------------------------------------

class StructuredFormatter(logging.Formatter):
    """
    Custom log formatter that produces human-readable, coloured output.

    Format:
        [YYYY-MM-DD HH:MM:SS] LEVEL    [module_name] message
    """

    # ANSI escape codes for terminal colours (gracefully ignored by most IDEs)
    LEVEL_COLORS: dict[str, str] = {
        "DEBUG":    "\033[36m",   # cyan
        "INFO":     "\033[32m",   # green
        "WARNING":  "\033[33m",   # yellow
        "ERROR":    "\033[31m",   # red
        "CRITICAL": "\033[35m",   # magenta
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        """Compose the final log line string from a LogRecord."""
        color  = self.LEVEL_COLORS.get(record.levelname, "")
        ts     = datetime.fromtimestamp(record.created).strftime("%Y-%m-%d %H:%M:%S")
        level  = f"{color}{record.levelname:<8}{self.RESET}"
        module = record.module
        return f"[{ts}] {level} [{module}] {record.getMessage()}"


# ---------------------------------------------------------------------------
# Logger factory
# ---------------------------------------------------------------------------

def get_logger(name: str, level: int = logging.DEBUG) -> logging.Logger:
    """
    Return a named, pre-configured Logger instance.

    Calling get_logger with the same name multiple times is safe — duplicate
    handlers are prevented so log lines are never printed more than once.

    Args:
        name  : Logical name for the logger, typically the module name.
        level : Minimum log level (default: DEBUG to capture all messages).

    Returns:
        A logging.Logger instance ready for use.
    """
    logger = logging.getLogger(name)

    # Guard: if handlers already attached, return as-is to avoid duplicates
    if logger.handlers:
        return logger

    logger.setLevel(level)

    # Write to stdout so container / CI log collectors can pick it up
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(StructuredFormatter())
    logger.addHandler(handler)

    # Prevent log records from bubbling up to the root logger
    logger.propagate = False

    return logger


# ---------------------------------------------------------------------------
# Decorator middleware
# ---------------------------------------------------------------------------

def log_call(logger: logging.Logger):
    """
    Decorator factory: wrap a function with entry / exit / error logging.

    Logs:
      - DEBUG on entry  : function name + arguments
      - DEBUG on exit   : function name + success confirmation
      - ERROR on raise  : exception type and message (then re-raises)

    Usage:
        @log_call(log)
        def my_function(x, y): ...
    """
    def decorator(fn):
        @wraps(fn)  # preserve the original function's __name__, __doc__, etc.
        def wrapper(*args, **kwargs):
            logger.debug(f"→ {fn.__name__}() called | args={args} kwargs={kwargs}")
            try:
                result = fn(*args, **kwargs)
                logger.debug(f"← {fn.__name__}() returned successfully")
                return result
            except Exception as exc:
                logger.error(f"✖ {fn.__name__}() raised {type(exc).__name__}: {exc}")
                raise  # always re-raise so callers can handle the exception
        return wrapper
    return decorator

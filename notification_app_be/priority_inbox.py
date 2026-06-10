"""
notification_app_be/priority_inbox.py
======================================
Stage 1 – Campus Notifications Priority Inbox
----------------------------------------------
Fetches live notifications from the Evaluation API and surfaces the
top-N highest-priority **unread** notifications using a fixed-capacity
min-heap, giving O(log N) insert time for incoming events.

Priority formula
----------------
    score = TYPE_WEIGHT[type] × 1_000_000_000 + unix_timestamp_seconds

Type weights (higher = more important):
    Placement → 3
    Result    → 2
    Event     → 1

Multiplying weight by 10⁹ guarantees the type dimension always dominates;
the unix timestamp acts as a tie-breaker within the same type so that newer
notifications rank above older ones of the same category.

Usage
-----
    python priority_inbox.py --token <API_TOKEN>
    python priority_inbox.py --top 15 --token <API_TOKEN>

    # Or set the token via environment variable:
    export NOTIFICATION_API_TOKEN=<token>
    python priority_inbox.py --top 20
"""

from __future__ import annotations

import heapq
import os
import sys
from datetime import datetime

import requests

# ---------------------------------------------------------------------------
# Path setup: allow importing the shared logging middleware from sibling folder
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'logging_middleware'))
from logger import get_logger, log_call  # noqa: E402  (import after sys.path patch)

# ---------------------------------------------------------------------------
# Module logger  — all log output goes through the shared middleware
# ---------------------------------------------------------------------------
log = get_logger("priority_inbox")

# ---------------------------------------------------------------------------
# Configuration constants
# ---------------------------------------------------------------------------

# Base URL for the campus notification evaluation service
API_URL = "http://4.224.186.213/evaluation-service/notifications"

# Read bearer token from environment variable (avoids hard-coding secrets)
API_TOKEN = os.getenv("NOTIFICATION_API_TOKEN", "")

# Weight table: determines how strongly each notification type is prioritised
TYPE_WEIGHT: dict[str, int] = {
    "Placement": 3,   # highest priority — career-critical
    "Result":    2,   # medium priority  — academic importance
    "Event":     1,   # lowest priority  — informational
}

# Expected timestamp format returned by the API
TIMESTAMP_FMT = "%Y-%m-%d %H:%M:%S"


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

class Notification:
    """
    Lightweight value object representing a single campus notification.

    Attributes:
        id        : UUID string — unique identifier from the API.
        type      : One of 'Placement', 'Result', 'Event'.
        message   : Human-readable notification text.
        timestamp : Raw timestamp string from the API (TIMESTAMP_FMT).
        score     : Pre-computed priority score (used for heap ordering).
        viewed    : Whether the user has already seen this notification.
    """

    # __slots__ reduces per-instance memory overhead (no __dict__ created)
    __slots__ = ("id", "type", "message", "timestamp", "score", "viewed")

    def __init__(self, id: str, type: str, message: str, timestamp: str) -> None:
        self.id        = id
        self.type      = type
        self.message   = message
        self.timestamp = timestamp
        self.score     = self._compute_score()
        self.viewed    = False  # all notifications start as unread

    def _compute_score(self) -> float:
        """
        Compute the priority score.

        Formula: weight × 10⁹ + unix_timestamp
        Higher score → higher priority in the inbox.
        """
        weight = TYPE_WEIGHT.get(self.type, 0)
        try:
            ts = datetime.strptime(self.timestamp, TIMESTAMP_FMT).timestamp()
        except ValueError:
            # Gracefully handle unexpected timestamp formats
            log.warning(f"Unparseable timestamp '{self.timestamp}' for {self.id}; defaulting to 0")
            ts = 0.0
        return weight * 1_000_000_000 + ts

    def __repr__(self) -> str:
        return (
            f"Notification(id={self.id!r}, type={self.type!r}, "
            f"message={self.message!r}, ts={self.timestamp!r}, score={self.score:.0f})"
        )


# ---------------------------------------------------------------------------
# API layer
# ---------------------------------------------------------------------------

@log_call(log)
def fetch_notifications(token: str = API_TOKEN) -> list[Notification]:
    """
    Fetch all available notifications from the Evaluation API.

    Args:
        token : Bearer token for the protected API route.

    Returns:
        List of Notification objects parsed from the JSON response.

    Raises:
        requests.RequestException : on network or HTTP error.
    """
    # Build auth header only when a token is provided
    headers: dict[str, str] = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    log.info(f"Requesting notifications → {API_URL}")

    try:
        response = requests.get(API_URL, headers=headers, timeout=15)
        response.raise_for_status()  # raises HTTPError for 4xx / 5xx
    except requests.RequestException as exc:
        log.error(f"API request failed: {exc}")
        raise

    payload = response.json()
    raw_list = payload.get("notifications", [])
    log.info(f"Received {len(raw_list)} raw notification(s) from API")

    notifications: list[Notification] = []
    for item in raw_list:
        try:
            notif = Notification(
                id        = item["ID"],
                type      = item["Type"],
                message   = item["Message"],
                timestamp = item["Timestamp"],
            )
            notifications.append(notif)
            log.debug(f"Parsed → {notif}")
        except KeyError as missing_key:
            # Skip malformed records rather than crashing the whole fetch
            log.warning(f"Skipping malformed notification (missing {missing_key}): {item}")

    return notifications


# ---------------------------------------------------------------------------
# Priority Inbox — fixed-capacity max-heap (implemented as min-heap on -score)
# ---------------------------------------------------------------------------

class PriorityInbox:
    """
    Maintains the top-N highest-priority notifications using a min-heap.

    How it works
    ------------
    Python's heapq is a min-heap.  We store entries as (-score, id, Notification)
    so the heap root is always the *lowest-scoring* item inside the top-N window.
    When a new notification arrives:
      - If the heap is not yet full → push unconditionally.
      - If full and new score > root score → replace root (heapreplace).
      - Otherwise → discard (new notification doesn't make the cut).

    This gives O(log N) per insertion and O(N) space — ideal for a real-time
    notification stream where N is small (10–30).

    A `seen_ids` set provides O(1) average deduplication.
    """

    def __init__(self, capacity: int = 10) -> None:
        """
        Args:
            capacity : Maximum number of notifications to track (i.e. "Top N").
        """
        self.capacity = capacity
        # Internal heap: each entry = (-score, id, Notification)
        self._heap: list[tuple[float, str, Notification]] = []
        # Track IDs already seen to prevent duplicates
        self._seen_ids: set[str] = set()
        log.info(f"PriorityInbox initialised with capacity={capacity}")

    @log_call(log)
    def push(self, notification: Notification) -> None:
        """
        Attempt to add a notification to the top-N inbox.

        The notification is silently ignored if:
          - Its ID has already been seen (duplicate), or
          - Its priority score is below the current minimum in the inbox.

        Args:
            notification : The Notification object to evaluate.
        """
        # --- Deduplication check ---
        if notification.id in self._seen_ids:
            log.debug(f"Duplicate skipped: {notification.id}")
            return
        self._seen_ids.add(notification.id)

        entry = (-notification.score, notification.id, notification)

        if len(self._heap) < self.capacity:
            # Heap not yet full — always accept
            heapq.heappush(self._heap, entry)
            log.debug(f"Pushed (heap size {len(self._heap)}/{self.capacity}): {notification.id}")
        else:
            # Heap full — compare against the current weakest item (heap root)
            worst_neg_score, _, _ = self._heap[0]
            if -notification.score < worst_neg_score:
                # New notification beats the current worst → swap it in
                evicted = heapq.heapreplace(self._heap, entry)
                log.debug(
                    f"Evicted {evicted[1]} (score={-evicted[0]:.0f}), "
                    f"inserted {notification.id} (score={notification.score:.0f})"
                )
            else:
                log.debug(
                    f"Below threshold — discarded: {notification.id} "
                    f"(score={notification.score:.0f})"
                )

    @log_call(log)
    def top_n(self) -> list[Notification]:
        """
        Return the top-N notifications sorted from highest to lowest priority.

        Returns:
            List of Notification objects in descending priority order.
        """
        # Sort heap entries by ascending (-score) → gives descending score order
        sorted_entries = sorted(self._heap, key=lambda x: x[0])
        return [entry[2] for entry in sorted_entries]

    @log_call(log)
    def mark_viewed(self, notification_id: str) -> None:
        """
        Mark a notification as viewed/read.

        Args:
            notification_id : The UUID of the notification to mark.
        """
        for _, nid, notif in self._heap:
            if nid == notification_id:
                notif.viewed = True
                log.info(f"Marked as viewed: {notification_id}")
                return
        log.warning(f"mark_viewed: ID not found in top-N: {notification_id}")

    def __len__(self) -> int:
        return len(self._heap)


# ---------------------------------------------------------------------------
# Display helpers
# ---------------------------------------------------------------------------

# Terminal colour / style escape codes
TYPE_ICON  = {"Placement": "💼", "Result": "📊", "Event": "🗓️"}
TYPE_COLOR = {
    "Placement": "\033[92m",   # bright green
    "Result":    "\033[94m",   # bright blue
    "Event":     "\033[93m",   # bright yellow
}
RESET = "\033[0m"
BOLD  = "\033[1m"
DIM   = "\033[2m"


@log_call(log)
def print_priority_inbox(inbox: PriorityInbox) -> None:
    """
    Render the priority inbox to stdout in a readable tabular format.

    Each notification shows:
      Rank | Type icon | Read status | Message | Timestamp | Score | ID
    """
    top     = inbox.top_n()
    divider = "─" * 72

    print(f"\n{BOLD}{divider}")
    print(f"  🔔  PRIORITY INBOX  │  Top {len(top)} of {inbox.capacity}")
    print(f"{divider}{RESET}\n")

    for rank, notif in enumerate(top, start=1):
        color  = TYPE_COLOR.get(notif.type, "")
        icon   = TYPE_ICON.get(notif.type, "🔔")
        status = f"{DIM}[READ]{RESET}" if notif.viewed else f"\033[97m[NEW] {RESET}"

        print(f"  {BOLD}#{rank:>2}{RESET}  {color}{icon} {notif.type:<12}{RESET}  {status}")
        print(f"        {BOLD}{notif.message}{RESET}")
        print(f"        {DIM}{notif.timestamp}   score={notif.score:.0f}{RESET}")
        print(f"        {DIM}id: {notif.id}{RESET}")
        print(f"  {divider}")

    print()  # trailing blank line for readability


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main(top_n: int = 10, token: str = API_TOKEN) -> None:
    """
    Orchestrate the full Priority Inbox workflow:
      1. Fetch notifications from the API.
      2. Build the priority inbox (heap).
      3. Mark the top notification as read (demo).
      4. Simulate a new live notification arriving.
      5. Print the refreshed inbox.
    """
    log.info(f"=== Campus Notifications — Priority Inbox (top_n={top_n}) ===")

    # Step 1: fetch from API
    notifications = fetch_notifications(token)

    # Step 2: populate the heap-backed inbox
    inbox = PriorityInbox(capacity=top_n)
    for notif in notifications:
        inbox.push(notif)
    log.info(f"Inbox populated: {len(inbox)}/{top_n} slots filled")

    # Step 3: demo — mark the top-ranked item as viewed
    top = inbox.top_n()
    if top:
        inbox.mark_viewed(top[0].id)

    # Step 4: display current state
    print_priority_inbox(inbox)

    # Step 5: simulate a brand-new incoming notification (e.g. via push event)
    log.info("Simulating a new real-time Placement notification …")
    live_notif = Notification(
        id        = "LIVE-0001",
        type      = "Placement",
        message   = "Google SWE Internship — applications open now!",
        timestamp = datetime.now().strftime(TIMESTAMP_FMT),
    )
    inbox.push(live_notif)
    log.info("Live notification pushed — refreshing display …")
    print_priority_inbox(inbox)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Campus Notifications — Priority Inbox CLI",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--top",
        type    = int,
        default = 10,
        help    = "Number of top-priority notifications to display (e.g. 10, 15, 20)",
    )
    parser.add_argument(
        "--token",
        type    = str,
        default = API_TOKEN,
        help    = "Bearer token for the Evaluation API (overrides NOTIFICATION_API_TOKEN env var)",
    )
    args = parser.parse_args()

    main(top_n=args.top, token=args.token)

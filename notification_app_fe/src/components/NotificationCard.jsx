/**
 * notification_app_fe/src/components/NotificationCard.jsx
 * =========================================================
 * Renders a single notification as a Material UI Card.
 *
 * Visual states:
 *   - NEW  (unread): highlighted border, full opacity, clickable to mark read.
 *   - READ (viewed): dimmed, flat border, non-interactive cursor.
 *
 * Props:
 *   notification {object}   - Raw notification object from the API.
 *   viewed       {boolean}  - Whether the user has already seen this item.
 *   onMarkViewed {function} - Callback invoked with the notification ID when
 *                             the user clicks the card or the mark-read icon.
 *   rank         {number|null} - Optional rank badge (1-based) shown for
 *                                Priority Inbox items. Omit for All tab.
 */

import React from 'react';
import {
  Card, CardContent, Chip, Typography, Box, Tooltip, IconButton,
} from '@mui/material';
import WorkIcon          from '@mui/icons-material/Work';
import BarChartIcon      from '@mui/icons-material/BarChart';
import EventIcon         from '@mui/icons-material/Event';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import FiberNewIcon      from '@mui/icons-material/FiberNew';

import { getLogger } from '../utils/logger';

const log = getLogger('NotificationCard');

// ---------------------------------------------------------------------------
// Type metadata — icon, accent colour, and dark tinted background per type
// ---------------------------------------------------------------------------
const TYPE_META = {
  Placement: { icon: <WorkIcon fontSize="small" />,     color: '#22c55e', bg: '#052e16' },
  Result:    { icon: <BarChartIcon fontSize="small" />, color: '#60a5fa', bg: '#0c1a3a' },
  Event:     { icon: <EventIcon fontSize="small" />,    color: '#facc15', bg: '#1a1500' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert an API timestamp string to a human-readable relative label.
 * Examples: "3m ago", "2h ago", "1d ago"
 *
 * @param {string} ts - Timestamp in "YYYY-MM-DD HH:MM:SS" format.
 * @returns {string} Relative time label.
 */
function timeAgo(ts) {
  const diffMs   = Date.now() - new Date(ts.replace(' ', 'T')).getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 60)  return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs  < 24)  return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NotificationCard({ notification, viewed, onMarkViewed, rank }) {
  // Fall back to Event styling for any unrecognised type
  const meta = TYPE_META[notification.Type] ?? TYPE_META.Event;

  /**
   * Handle the mark-as-read icon button click.
   * stopPropagation prevents the card-level onClick from firing twice.
   */
  function handleMarkRead(e) {
    e.stopPropagation();
    log.info(`User explicitly marked notification as read: ${notification.ID}`);
    onMarkViewed(notification.ID);
  }

  return (
    <Card
      onClick={() => !viewed && onMarkViewed(notification.ID)} // click card → mark read
      sx={{
        bgcolor:    viewed ? '#0f172a' : '#1e293b',
        border:     viewed ? '1px solid #1e293b' : `1px solid ${meta.color}33`,
        borderRadius: 2,
        cursor:     viewed ? 'default' : 'pointer',
        transition: 'all 0.18s ease',
        opacity:    viewed ? 0.65 : 1,
        // Lift card slightly on hover to indicate interactivity (unread only)
        '&:hover': viewed ? {} : {
          borderColor: meta.color,
          transform:   'translateY(-2px)',
          boxShadow:   `0 4px 20px ${meta.color}22`,
        },
        position: 'relative',
        overflow: 'visible', // allow rank badge to overflow card top edge
      }}
    >
      {/* Rank badge — only shown in Priority Inbox tab */}
      {rank && (
        <Box sx={{
          position:   'absolute', top: -10, left: 12,
          bgcolor:    meta.color,
          color:      '#000',
          borderRadius: '50%',
          width: 22, height: 22,
          display:    'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 11,
        }}>
          {rank}
        </Box>
      )}

      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        {/* ── Top row: type chip + new badge + relative time + mark-read button ── */}
        <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={1}>
          {/* Left: type chip + new indicator */}
          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
            <Chip
              icon={meta.icon}
              label={notification.Type}
              size="small"
              sx={{
                bgcolor:  meta.bg,
                color:    meta.color,
                fontWeight: 700,
                fontSize: 11,
                '& .MuiChip-icon': { color: meta.color },
              }}
            />
            {/* Unread indicator — only shown for new notifications */}
            {!viewed && (
              <FiberNewIcon sx={{ color: '#f87171', fontSize: 18 }} titleAccess="Unread" />
            )}
          </Box>

          {/* Right: relative timestamp + mark-read button */}
          <Box display="flex" alignItems="center" gap={0.5}>
            <Typography variant="caption" sx={{ color: '#64748b', whiteSpace: 'nowrap' }}>
              {timeAgo(notification.Timestamp)}
            </Typography>
            {!viewed && (
              <Tooltip title="Mark as read">
                <IconButton
                  size="small"
                  onClick={handleMarkRead}
                  sx={{ color: '#64748b', p: 0.3 }}
                >
                  <MarkEmailReadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* ── Message body ── */}
        <Typography
          variant="body2"
          sx={{
            mt:         0.75,
            color:      viewed ? '#94a3b8' : '#e2e8f0',
            fontWeight: viewed ? 400 : 500,
            fontSize:   13,
          }}
        >
          {notification.Message}
        </Typography>

        {/* ── Footer: full timestamp + UUID ── */}
        <Typography variant="caption" sx={{ color: '#475569', display: 'block', mt: 0.5, fontSize: 10 }}>
          {notification.Timestamp} · {notification.ID}
        </Typography>
      </CardContent>
    </Card>
  );
}

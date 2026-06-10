/**
 * notification_app_fe/src/components/StatsBar.jsx
 * =================================================
 * Summary statistics bar displayed at the top of the dashboard.
 *
 * Shows at-a-glance counts for:
 *   - Unread notifications (across all types)
 *   - Placements
 *   - Results
 *   - Events
 *
 * Props:
 *   notifications {Array<object>} - Full list of notifications from the hook.
 *   unreadCount   {number}        - Pre-computed unread count from the hook.
 */

import React from 'react';
import { Box, Typography } from '@mui/material';
import WorkIcon       from '@mui/icons-material/Work';
import BarChartIcon   from '@mui/icons-material/BarChart';
import EventIcon      from '@mui/icons-material/Event';
import FiberNewIcon   from '@mui/icons-material/FiberNew';

// ---------------------------------------------------------------------------
// Stat tile sub-component
// ---------------------------------------------------------------------------

/**
 * A single stat tile: icon on the left, label above value on the right.
 *
 * @param {{ icon, label, value, color }} props
 */
function StatTile({ icon, label, value, color }) {
  return (
    <Box
      sx={{
        display:      'flex',
        alignItems:   'center',
        gap:          1,
        bgcolor:      '#0f172a',
        border:       '1px solid #1e293b',
        borderRadius: 2,
        px: 2, py: 1.25,
      }}
    >
      {/* Coloured icon matching the notification type */}
      <Box sx={{ color, display: 'flex' }}>{icon}</Box>

      <Box>
        {/* Label (e.g. "Placements") */}
        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', lineHeight: 1 }}>
          {label}
        </Typography>
        {/* Numeric count — large for quick scanning */}
        <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// StatsBar
// ---------------------------------------------------------------------------

export default function StatsBar({ notifications, unreadCount }) {
  // Tally counts per type from the current notification list
  const counts = { Placement: 0, Result: 0, Event: 0 };
  notifications.forEach(n => {
    if (counts[n.Type] !== undefined) counts[n.Type]++;
  });

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
      <StatTile icon={<FiberNewIcon />}  label="Unread"     value={unreadCount}      color="#f87171" />
      <StatTile icon={<WorkIcon />}      label="Placements" value={counts.Placement} color="#22c55e" />
      <StatTile icon={<BarChartIcon />}  label="Results"    value={counts.Result}    color="#60a5fa" />
      <StatTile icon={<EventIcon />}     label="Events"     value={counts.Event}     color="#facc15" />
    </Box>
  );
}

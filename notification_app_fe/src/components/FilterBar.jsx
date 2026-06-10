/**
 * notification_app_fe/src/components/FilterBar.jsx
 * ==================================================
 * Control panel for filtering notifications.
 *
 * Provides:
 *   1. Type filter  — ToggleButtonGroup to switch between All / Placement /
 *                     Result / Event.  Selection triggers an API re-fetch.
 *   2. Top-N slider — MUI Slider (5–30, step 5) to control how many
 *                     notifications are shown in the Priority Inbox tab.
 *
 * Props:
 *   typeFilter    {string}   - Currently active type ('All' | 'Placement' | ...)
 *   setTypeFilter {function} - Setter from useNotifications hook.
 *   topN          {number}   - Current top-N value.
 *   setTopN       {function} - Setter from useNotifications hook.
 */

import React from 'react';
import {
  Box, Typography, ToggleButtonGroup, ToggleButton, Slider,
} from '@mui/material';
import WorkIcon     from '@mui/icons-material/Work';
import BarChartIcon from '@mui/icons-material/BarChart';
import EventIcon    from '@mui/icons-material/Event';
import AllInboxIcon from '@mui/icons-material/AllInbox';

import { getLogger } from '../utils/logger';

const log = getLogger('FilterBar');

// ---------------------------------------------------------------------------
// Filter options definition
// ---------------------------------------------------------------------------

/**
 * Available notification type filters.
 * 'All' sends no notification_type param to the API (returns everything).
 */
const TYPE_OPTIONS = [
  { label: 'All',       value: 'All',       icon: <AllInboxIcon fontSize="small" /> },
  { label: 'Placement', value: 'Placement', icon: <WorkIcon fontSize="small" /> },
  { label: 'Result',    value: 'Result',    icon: <BarChartIcon fontSize="small" /> },
  { label: 'Event',     value: 'Event',     icon: <EventIcon fontSize="small" /> },
];

// Tick marks for the Top-N slider
const SLIDER_MARKS = [5, 10, 15, 20, 25, 30].map(v => ({ value: v, label: `${v}` }));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FilterBar({ typeFilter, setTypeFilter, topN, setTopN }) {

  /**
   * Handle type filter toggle.
   * MUI ToggleButtonGroup passes null when the user clicks the active button
   * (deselect) — we ignore that to keep a selection always active.
   */
  function handleTypeChange(_, newValue) {
    if (!newValue) return; // prevent deselection (always keep one active)
    log.info(`Type filter changed → ${newValue}`);
    setTypeFilter(newValue);
  }

  /**
   * Handle Top-N slider change.
   * The second argument from MUI Slider onChange is the new value.
   */
  function handleTopNChange(_, newValue) {
    log.info(`Top-N changed → ${newValue}`);
    setTopN(newValue);
  }

  return (
    <Box
      sx={{
        display:     'flex',
        flexWrap:    'wrap',
        gap:         3,
        alignItems:  'center',
        bgcolor:     '#0f172a',
        borderRadius: 2,
        px: 2.5, py: 2,
        border: '1px solid #1e293b',
      }}
    >
      {/* ── Type filter ─────────────────────────────────────────────────── */}
      <Box>
        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 0.5 }}>
          FILTER BY TYPE
        </Typography>
        <ToggleButtonGroup
          value={typeFilter}
          exclusive              // only one option active at a time
          onChange={handleTypeChange}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              color:       '#64748b',
              borderColor: '#1e293b',
              fontSize:    12,
              fontWeight:  600,
              py: 0.5, px: 1.5,
              gap: 0.5,
              textTransform: 'none',
            },
            '& .Mui-selected': {
              bgcolor:     '#1e293b !important',
              color:       '#e2e8f0 !important',
              borderColor: '#334155 !important',
            },
          }}
        >
          {TYPE_OPTIONS.map(opt => (
            <ToggleButton key={opt.value} value={opt.value}>
              {opt.icon} {opt.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* ── Top-N slider ─────────────────────────────────────────────────── */}
      <Box sx={{ minWidth: 200, flex: 1 }}>
        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 0.5 }}>
          PRIORITY INBOX — TOP {topN}
        </Typography>
        <Slider
          value={topN}
          onChange={handleTopNChange}
          min={5}
          max={30}
          step={5}
          marks={SLIDER_MARKS}
          valueLabelDisplay="auto"
          sx={{
            color: '#60a5fa',
            '& .MuiSlider-markLabel': { color: '#475569', fontSize: 10 },
          }}
        />
      </Box>
    </Box>
  );
}

/**
 * notification_app_fe/src/App.jsx
 * =================================
 * Root application component for the Campus Notifications dashboard.
 *
 * Layout structure:
 *   ┌─────────────────────────────────────┐
 *   │  Sticky Header (logo + actions)     │
 *   ├─────────────────────────────────────┤
 *   │  StatsBar  (counts per type)        │
 *   │  FilterBar (type toggle + top-N)    │
 *   │  Tabs: [Priority Inbox] [All]       │
 *   │  Notification Grid (responsive)     │
 *   └─────────────────────────────────────┘
 *
 * State is fully managed by the useNotifications hook; this component is
 * responsible only for layout and orchestrating child components.
 */

import React, { useState } from 'react';
import {
  Box, Typography, Container, Tabs, Tab, Button, Alert,
  CircularProgress, Tooltip, useMediaQuery, useTheme,
} from '@mui/material';
import RefreshIcon        from '@mui/icons-material/Refresh';
import StarIcon           from '@mui/icons-material/Star';
import NotificationsIcon  from '@mui/icons-material/Notifications';
import DoneAllIcon        from '@mui/icons-material/DoneAll';

import useNotifications   from './hooks/useNotifications';
import NotificationCard   from './components/NotificationCard';
import FilterBar          from './components/FilterBar';
import StatsBar           from './components/StatsBar';
import { getLogger }      from './utils/logger';

// Module-scoped logger for App-level events
const log = getLogger('App');

// ---------------------------------------------------------------------------
// Tab index constants — improves readability vs magic numbers
// ---------------------------------------------------------------------------
const TAB_PRIORITY = 0;
const TAB_ALL      = 1;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function App() {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Active tab index (Priority Inbox vs All Notifications)
  const [tab, setTab] = useState(TAB_PRIORITY);

  // All notification state and helpers from the custom hook
  const {
    allNotifications,
    priorityNotifications,
    loading,
    error,
    typeFilter,
    setTypeFilter,
    topN,
    setTopN,
    viewedIds,
    markViewed,
    markAllViewed,
    refresh,
    lastFetched,
    unreadCount,
  } = useNotifications();

  /** Log tab change and update active index. */
  function handleTabChange(_, newTab) {
    log.info(`Tab switched → ${newTab === TAB_PRIORITY ? 'Priority Inbox' : 'All Notifications'}`);
    setTab(newTab);
  }

  // Choose the correct list based on the active tab
  const displayList = tab === TAB_PRIORITY ? priorityNotifications : allNotifications;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#020817', color: '#e2e8f0' }}>

      {/* ================================================================
          Sticky Header
          ================================================================ */}
      <Box
        sx={{
          bgcolor:      '#0a1628',
          borderBottom: '1px solid #1e293b',
          position:     'sticky',
          top:          0,
          zIndex:       100,
          backdropFilter: 'blur(8px)', // glass-morphism effect on scroll
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display:     'flex',
              alignItems:  'center',
              justifyContent: 'space-between',
              py: 1.5,
              flexWrap: 'wrap',
              gap: 1,
            }}
          >
            {/* Brand mark */}
            <Box display="flex" alignItems="center" gap={1.5}>
              <Box
                sx={{
                  bgcolor:      '#1e3a5f',
                  borderRadius: '50%',
                  p:            0.8,
                  display:      'flex',
                  border:       '1px solid #2563eb44',
                }}
              >
                <NotificationsIcon sx={{ color: '#60a5fa', fontSize: 20 }} />
              </Box>
              <Box>
                <Typography
                  variant={isMobile ? 'subtitle1' : 'h6'}
                  sx={{ fontWeight: 800, color: '#f1f5f9', lineHeight: 1 }}
                >
                  Campus Notify
                </Typography>
                <Typography variant="caption" sx={{ color: '#475569' }}>
                  GLA University — Real-time updates
                </Typography>
              </Box>
            </Box>

            {/* Header action buttons */}
            <Box display="flex" alignItems="center" gap={1}>
              {/* Last-fetched timestamp — hidden on mobile to save space */}
              {lastFetched && (
                <Typography
                  variant="caption"
                  sx={{ color: '#475569', display: { xs: 'none', sm: 'block' } }}
                >
                  Updated {lastFetched.toLocaleTimeString()}
                </Typography>
              )}

              {/* Mark all read */}
              <Tooltip title="Mark all notifications as read">
                <Button
                  size="small"
                  startIcon={<DoneAllIcon />}
                  onClick={markAllViewed}
                  sx={{ color: '#64748b', textTransform: 'none', fontSize: 12 }}
                >
                  {!isMobile && 'Read all'}
                </Button>
              </Tooltip>

              {/* Manual refresh */}
              <Button
                size="small"
                variant="outlined"
                startIcon={loading ? <CircularProgress size={12} /> : <RefreshIcon />}
                onClick={refresh}
                disabled={loading}
                sx={{
                  borderColor: '#1e293b',
                  color:       '#94a3b8',
                  textTransform: 'none',
                  fontSize:    12,
                  '&:hover':   { borderColor: '#60a5fa', color: '#60a5fa' },
                }}
              >
                {!isMobile && 'Refresh'}
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* ================================================================
          Main Content
          ================================================================ */}
      <Container maxWidth="lg" sx={{ py: 3 }}>

        {/* Stats summary row */}
        <StatsBar notifications={allNotifications} unreadCount={unreadCount} />

        {/* Type filter + Top-N controls */}
        <Box sx={{ mt: 2 }}>
          <FilterBar
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            topN={topN}
            setTopN={setTopN}
          />
        </Box>

        {/* Tab navigation */}
        <Box sx={{ mt: 2.5, borderBottom: '1px solid #1e293b' }}>
          <Tabs
            value={tab}
            onChange={handleTabChange}
            sx={{
              '& .MuiTab-root':    { color: '#64748b', textTransform: 'none', fontWeight: 600, fontSize: 13 },
              '& .Mui-selected':   { color: '#60a5fa !important' },
              '& .MuiTabs-indicator': { bgcolor: '#60a5fa' },
            }}
          >
            {/* Priority Inbox tab — shows ranked top-N */}
            <Tab
              label={
                <Box display="flex" alignItems="center" gap={0.8}>
                  <StarIcon fontSize="small" />
                  Priority Inbox
                  <Box sx={{ bgcolor: '#1e3a5f', color: '#60a5fa', borderRadius: 1, px: 0.8, fontSize: 11, fontWeight: 700 }}>
                    Top {topN}
                  </Box>
                </Box>
              }
            />

            {/* All Notifications tab — shows full unfiltered list */}
            <Tab
              label={
                <Box display="flex" alignItems="center" gap={0.8}>
                  <NotificationsIcon fontSize="small" />
                  All Notifications
                  <Box sx={{ bgcolor: '#1e293b', color: '#94a3b8', borderRadius: 1, px: 0.8, fontSize: 11, fontWeight: 700 }}>
                    {allNotifications.length}
                  </Box>
                </Box>
              }
            />
          </Tabs>
        </Box>

        {/* ── Tab content area ───────────────────────────────────────── */}
        <Box sx={{ mt: 2 }}>

          {/* Error banner */}
          {error && (
            <Alert
              severity="error"
              sx={{ mb: 2, bgcolor: '#1c0a0a', border: '1px solid #7f1d1d', color: '#fca5a5' }}
            >
              {error}
            </Alert>
          )}

          {/* Full-page loading spinner */}
          {loading && (
            <Box display="flex" justifyContent="center" py={6}>
              <CircularProgress sx={{ color: '#60a5fa' }} />
            </Box>
          )}

          {/* Empty state — shown when fetch succeeds but returns nothing */}
          {!loading && !error && displayList.length === 0 && (
            <Box
              sx={{
                textAlign:    'center',
                py:           8,
                border:       '1px dashed #1e293b',
                borderRadius: 2,
              }}
            >
              <NotificationsIcon sx={{ fontSize: 48, color: '#334155', mb: 1 }} />
              <Typography sx={{ color: '#475569' }}>No notifications to display</Typography>
              <Button
                onClick={refresh}
                sx={{ mt: 2, textTransform: 'none', color: '#60a5fa' }}
                startIcon={<RefreshIcon />}
              >
                Refresh
              </Button>
            </Box>
          )}

          {/* Responsive notification grid */}
          {!loading && displayList.length > 0 && (
            <Box
              sx={{
                display: 'grid',
                // 1 col on mobile, 2 on tablet, 3 on desktop
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
                gap: 1.5,
              }}
            >
              {displayList.map((notif, index) => (
                <NotificationCard
                  key={notif.ID}
                  notification={notif}
                  viewed={viewedIds.has(notif.ID)}
                  onMarkViewed={markViewed}
                  // Pass 1-based rank only for Priority Inbox cards
                  rank={tab === TAB_PRIORITY ? index + 1 : null}
                />
              ))}
            </Box>
          )}

        </Box>
      </Container>
    </Box>
  );
}

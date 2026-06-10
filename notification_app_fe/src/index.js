/**
 * notification_app_fe/src/index.js
 * ==================================
 * React application entry point.
 *
 * Responsibilities:
 *   1. Mount the React tree into the #root DOM element.
 *   2. Wrap the app in MUI ThemeProvider with a dark, custom theme.
 *   3. Apply CssBaseline to normalise browser default styles.
 *
 * The theme object is defined here (rather than in App.jsx) so that all
 * child components share a single source-of-truth for design tokens.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { createTheme, ThemeProvider, CssBaseline } from '@mui/material';
import App from './App';

// ---------------------------------------------------------------------------
// MUI Theme — dark mode with a blue primary and green secondary accent
// ---------------------------------------------------------------------------
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary:    { main: '#60a5fa' },  // blue-400 — used for interactive elements
    secondary:  { main: '#22c55e' },  // green-500 — used for Placement type
    background: {
      default: '#020817',  // near-black page background
      paper:   '#0f172a',  // slightly lighter surface for cards/modals
    },
  },
  typography: {
    // Use Inter for a clean, modern look; fall back to Roboto / system fonts
    fontFamily: '"Inter", "Roboto", sans-serif',
  },
  components: {
    // Remove shadow from all cards — rely on border instead for the dark theme
    MuiCard:   { defaultProps: { elevation: 0 } },
    // Flat buttons throughout (no drop shadow)
    MuiButton: { defaultProps: { disableElevation: true } },
  },
});

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* ThemeProvider makes the theme available to all MUI components */}
    <ThemeProvider theme={theme}>
      {/* CssBaseline: cross-browser CSS reset + applies background colour */}
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);

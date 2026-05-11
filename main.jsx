import React from 'react';
import ReactDOM from 'react-dom/client';

// Make React global for tweaks-panel.jsx which doesn't import it
window.React = React;
window.ReactDOM = ReactDOM;

// Load the tweaks panel
import './tweaks-panel.jsx';

// Load and run the app
import './app.jsx';

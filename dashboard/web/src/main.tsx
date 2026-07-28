import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Self-hosted Inter — Nocturne's type scale depends on it, and a self-hosted
// media stack may have no outbound internet to reach a CDN.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';

import './styles/nocturne.css';
import './styles/autoplexx.css';

import { App } from './app/App';

const container = document.getElementById('root');
if (!container) throw new Error('#root element is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

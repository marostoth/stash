import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SidePanelApp } from '@/components/sidepanel/side-panel-app';
import '@/styles/globals.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <SidePanelApp />
    </StrictMode>,
  );
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StashErrorBoundary } from '@/components/ui/error-boundary';
import { Workbench } from '@/components/workbench/workbench';
import '@/styles/globals.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <StashErrorBoundary scope="Stash">
        <Workbench />
      </StashErrorBoundary>
    </StrictMode>,
  );
}

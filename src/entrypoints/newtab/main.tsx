import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Workbench } from '@/components/workbench/workbench';
import '@/styles/globals.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <Workbench />
    </StrictMode>,
  );
}

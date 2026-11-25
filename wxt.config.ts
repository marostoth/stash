import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Stash',
    description:
      'A fast, local-first, visual bookmark and tab-session manager.',
    permissions: [
      'storage',
      'unlimitedStorage',
      'tabs',
      'tabGroups',
      'sidePanel',
    ],
    optional_permissions: ['bookmarks'],
    optional_host_permissions: ['https://*/*', 'http://*/*'],
    action: {
      default_title: 'Open Stash Side Panel',
    },
  },
});

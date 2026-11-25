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
      'contextMenus',
      'scripting',
    ],
    optional_permissions: ['bookmarks'],
    optional_host_permissions: ['https://*/*', 'http://*/*'],
    omnibox: {
      keyword: 's',
    },
    commands: {
      'open-stash-sidepanel': {
        suggested_key: {
          default: 'Alt+Shift+S',
        },
        description: 'Open Stash Side Panel',
      },
      'quick-stash-active-tab': {
        suggested_key: {
          default: 'Alt+Shift+D',
        },
        description: 'Quick-stash active tab',
      },
    },
    action: {
      default_title: 'Open Stash Side Panel',
    },
  },
});

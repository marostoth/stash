import { BackdropStudioCard } from '@/components/settings/backdrop-studio-card';
import { ThemesPanel } from '@/components/settings/themes-panel';
import type { StashSettings, ThemeDefinition } from '@/lib/types/stash';

interface AppearancePanelProps {
  allThemes: readonly ThemeDefinition[];
  activeTheme: ThemeDefinition;
  settings: StashSettings;
}

export function AppearancePanel({
  allThemes,
  activeTheme,
  settings,
}: AppearancePanelProps) {
  return (
    <div className="space-y-4">
      <ThemesPanel
        allThemes={allThemes}
        activeTheme={activeTheme}
        settings={settings}
      />

      <BackdropStudioCard activeTheme={activeTheme} settings={settings} />
    </div>
  );
}

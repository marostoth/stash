export default defineBackground(() => {
  if (browser.sidePanel?.setPanelBehavior) {
    browser.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error: unknown) => {
        console.warn('Stash: failed to set sidePanel behavior', error);
      });
  }
});

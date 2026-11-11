// The plugin is redundant in GoofCord
export function disableWebPWAPlugin() {
    console.log("Disabling WebPWA Vencord plugin...");

    const plugin = VC?.Plugins?.plugins?.WebPWA;
    const settings = VC?.Settings?.plugins?.WebPWA;

    if (!plugin) {
        console.warn("WebPWA Vencord plugin unavailable");
        return;
    }
    if (!settings) {
        console.warn("WebPWA Vencord settings unavailable");
        return;
    }
    plugin.enabledByDefault = false;
    settings.enabled = false;
}

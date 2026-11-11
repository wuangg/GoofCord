// The plugin is redundant in GoofCord
export function disableWebScreensharePlugin() {
    console.log("Disabling WebScreenShare Vencord plugin...");

    const plugin = VC?.Plugins?.plugins?.WebScreenShare;
    const settings = VC?.Settings?.plugins?.WebScreenShare;

    if (!plugin) {
        console.warn("WebScreenShare Vencord plugin unavailable");
        return;
    }
    if (!settings) {
        console.warn("WebScreenShare Vencord settings unavailable");
        return;
    }
    plugin.enabledByDefault = false;
    settings.enabled = false;
}

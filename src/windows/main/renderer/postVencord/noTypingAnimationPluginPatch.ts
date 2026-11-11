export function patchNoTypingAnimationPlugin() {
    console.log("Patching NoTypingAnimation Vencord plugin...");

    const styleId = "vc-no-typing-animation-css";
    const plugin = VC.Plugins.plugins.NoTypingAnimation as any;
    
    if (!plugin || plugin.__goofCordCssPatch) {
        return;
    }
    plugin.__goofCordCssPatch = true;
    
    const enableCss = () => {
        if (document.getElementById(styleId)) {
            return;
        }
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
            div[class*="typingDots_"] div[class*="dots_"] > span[class*="dot_"] {
                animation: none !important;
                opacity: 1 !important;
            }
        `;
        document.head.append(style);
    };
    const disableCss = () => {
        document.getElementById(styleId)?.remove();
    };

    const originalStart = plugin.start?.bind(plugin);
    const originalStop = plugin.stop?.bind(plugin);

    plugin.start = () => {
        originalStart?.();
        enableCss();
    };
    plugin.stop = () => {
        disableCss();
        originalStop?.();
    };
    if (plugin.started) {
        enableCss();
    }
}
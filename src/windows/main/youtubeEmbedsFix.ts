/** biome-ignore-all lint/suspicious/noExplicitAny: youtube embeds fix */
/** biome-ignore-all assist/source/organizeImports: youtube embeds fix */
import { registerHeadersHandler } from "../../modules/firewall.ts";
import type { BrowserWindow, WebFrameMain } from "electron";

export function initYoutubeEmbedsFix(window: BrowserWindow) {
    if ((initYoutubeEmbedsFix as any)._init) return;
    (initYoutubeEmbedsFix as any)._init = true;

    const wc = window.webContents;
    ensureCSPRulesExist();

    wc.on("dom-ready", () => {
        modifyIframeSrcAttributes(window);
    });
    wc.on("frame-created", (_, { frame }) => {
        if (!frame) return;
		frame.once("dom-ready", () => {
			reloadFrameOnError(frame);
		});
	});
}

function ensureCSPRulesExist() {
    if ((ensureCSPRulesExist as any)._registered) return;
    (ensureCSPRulesExist as any)._registered = true;

    registerHeadersHandler(({ resourceType }, headers) => {
        if (resourceType !== "mainFrame" && resourceType !== "subFrame") {
            return;
        }
        const key = Object.keys(headers).find(k => k.toLowerCase() === "content-security-policy");

        if (!key) {
            return;
        }
        const header = headers[key];
        const csp = Array.isArray(header) ? (header[0] ?? "") : header;

        if (!/frame-src/.test(csp)) {
            return;
        }
        const newCsp = csp.replace(/frame-src\s([^;]*)/, (match, group: string) =>
            group.includes("https://*.youtube-nocookie.com") ? match : `frame-src ${group} https://*.youtube-nocookie.com`,
        );
        headers[key] = [newCsp];
    });
}

function modifyIframeSrcAttributes(window: BrowserWindow) {

    const youtubeVideoIdPattern: RegExp = /(?:youtube(?:-nocookie)?\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

    window.webContents.executeJavaScript(`
        new MutationObserver(() => {
            document.querySelectorAll('iframe').forEach(iframe => {
                if (iframe.src && iframe.src.startsWith("https://www.youtube.com/")) {
                    const pattern_match = iframe.src.match(${youtubeVideoIdPattern});
                    if (pattern_match && pattern_match.length >= 2) {
                        const video_id = pattern_match[1];
                        const params = new URL(iframe.src).search;
                        iframe.src = "https://www.youtube-nocookie.com/embed/" + video_id + params;
                    }
                }
            });
        }).observe(document.body, { childList: true, subtree:true });
    `);
}

function reloadFrameOnError(frame: WebFrameMain) {
    if (frame.url.startsWith("https://www.youtube.com/") || frame.url.startsWith("https://www.youtube-nocookie.com/")) {
        frame.executeJavaScript(`
            new MutationObserver(() => {
                if (document.querySelector('div.ytp-error-content-wrap-subreason a[href*="www.youtube.com/watch?v="]')) {
                    // Reload if we see the UMG style block
                    location.reload();
                }
                if (document.querySelector('div.ytp-error-content-wrap-reason span')) {
                    // Attempt to reload if we see a generic error (may solve "please sign in" error but usually does not)
                    location.reload();
                }
            }).observe(document.body, { childList: true, subtree: true });
        `);
    }
}
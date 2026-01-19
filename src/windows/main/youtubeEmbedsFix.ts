/** biome-ignore-all lint/suspicious/noExplicitAny: youtube embeds fix */

// biome-ignore assist/source/organizeImports: ???
import { session } from "electron";

import type {
    BrowserWindow,
    OnHeadersReceivedListenerDetails,
    WebFrameMain,
} from "electron";

const TARGET_URLS = [
    "https://cdn.discordapp.com/*",
];
const FRAME_SRC_DOMAIN = "https://www.youtube-nocookie.com";

export function initYoutubeEmbedsFix(window: BrowserWindow) {
    window.webContents.on("frame-created", (_, { frame }) => {
		if (!frame) return;
        ensureCSPRulesExist();
		modifyIframeSrcAttributes(window);

		frame.once("dom-ready", () => {
			reloadFrameOnError(frame);
		});
	});
}

export function ensureCSPRulesExist() {
    if ((ensureCSPRulesExist as any)._registered) return;
    (ensureCSPRulesExist as any)._registered = true;

    session.defaultSession.webRequest.onHeadersReceived(
        { urls: TARGET_URLS },
        (
            details: OnHeadersReceivedListenerDetails,
            callback: (response: { cancel?: boolean; responseHeaders?: Record<string, string[] | string> }) => void
        ) => {
            const headers = details.responseHeaders ?? {};
            const cspHeaderKey =
                Object.keys(headers).find(k => k.toLowerCase() === "content-security-policy") ??
                "Content-Security-Policy";

            const rawHeader = headers[cspHeaderKey];
            let existingCsp: string;

            if (Array.isArray(rawHeader)) {
                existingCsp = rawHeader[0] ?? "";
            } else if (typeof rawHeader === "string") {
                existingCsp = rawHeader;
            } else {
                existingCsp = "";
            }

            let newCsp: string;
            if (/frame-src/.test(existingCsp)) {
                newCsp = existingCsp.replace(/frame-src\s([^;]*)/, (match, group) => {
                    return group.includes(FRAME_SRC_DOMAIN)
                        ? match
                        : `frame-src ${group} ${FRAME_SRC_DOMAIN}`;
                });
            } else {
                newCsp = existingCsp ? `${existingCsp}; frame-src ${FRAME_SRC_DOMAIN}` : `frame-src ${FRAME_SRC_DOMAIN}`;
            }

            headers[cspHeaderKey] = [newCsp];
            callback({ responseHeaders: headers });
        }
    );
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
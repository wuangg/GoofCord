// This file contains everything that uses session.defaultSession.webRequest
import { session, OnBeforeSendHeadersListenerDetails, OnHeadersReceivedListenerDetails } from "electron";
import pc from "picocolors";

import type { Config, ConfigKey } from "../settingsSchema.ts";
import { getConfig, getDefaultValue } from "../stores/config/config.main.ts";

function getConfigOrDefault<K extends ConfigKey>(toGet: K): Config[K] {
	return getConfig("customFirewallRules") ? getConfig(toGet) : getDefaultValue(toGet);
}

export function initFirewall() {
	if (!getConfig("firewall")) return;
	const blocklist = getConfigOrDefault("blocklist");
	const blockedStrings = getConfigOrDefault("blockedStrings");
	const allowedStrings = getConfigOrDefault("allowedStrings");

	// If blocklist is not empty
	if (blocklist[0] !== "") {
		// Blocking URLs. This list works in tandem with "blockedStrings" list.
		session.defaultSession.webRequest.onBeforeRequest(
			{
				urls: blocklist,
			},
			(_, callback) => callback({ cancel: true }),
		);
	}

	/* If the request url includes any of those, it is blocked.
	 * By doing so, we can match multiple unwanted URLs, making the blocklist cleaner and more efficient */
	const blockRegex = new RegExp(blockedStrings.join("|"), "i"); // 'i' flag for case-insensitive matching
	const allowRegex = new RegExp(allowedStrings.join("|"), "i");

	registerHeadersSendHandler(({ resourceType, url }) => {
		// No need to filter non-xhr requests
		if (resourceType !== "xhr") return { cancel: false };

		if (blockRegex.test(url)) {
			if (!allowRegex.test(url)) {
				return { cancel: true };
			}
		}

		return { cancel: false };
	});

	console.log(pc.red("[Firewall]"), "Firewall initialized");
}

export type ResponseHeaders = Record<string, string[] | string>;
export type HeadersReceiveResult = void | { cancel?: boolean };
export type HeadersReceiveHandler = (details: OnHeadersReceivedListenerDetails, headers: ResponseHeaders) => HeadersReceiveResult;

const headersReceiveHandlers: HeadersReceiveHandler[] = [];

export function registerHeadersReceiveHandler(handler: HeadersReceiveHandler) {
	headersReceiveHandlers.push(handler);
}

export type RequestHeaders = Record<string, string[] | string>;
export type HeadersSendResult = void | { cancel?: boolean };
export type HeadersSendHandler = (details: OnBeforeSendHeadersListenerDetails, headers: RequestHeaders) => HeadersSendResult;

const headersSendHandlers: HeadersSendHandler[] = [];

export function registerHeadersSendHandler(handler: HeadersSendHandler) {
	headersSendHandlers.push(handler);
}

export function initHeadersHandlers() {
	unstrictCSP();

	session.defaultSession.webRequest.onBeforeSendHeaders((details, done) => {
		const headers = details.requestHeaders;
		if (!headers) return done({});

		for (const handler of [...headersSendHandlers]) {
			try {
				const result = handler(details, headers);
				if (result && result.cancel === true) return done({ cancel: true });
			} catch (e) {
				console.error(pc.red("[Firewall]"), "Headers send handler failed:", e);
			}
		}
		done({ requestHeaders: headers });
	});
	session.defaultSession.webRequest.onHeadersReceived((details, done) => {
		const headers = details.responseHeaders;
		if (!headers) return done({});

		for (const handler of [...headersReceiveHandlers]) {
			try {
				const result = handler(details, headers);
				if (result && result.cancel === true) return done({ cancel: true });
			} catch (e) {
				console.error(pc.red("[Firewall]"), "Headers receive handler failed:", e);
			}
		}
		done({ responseHeaders: headers });
	});
}

function unstrictCSP() {
	if ((unstrictCSP as any)._registered) return;
    (unstrictCSP as any)._registered = true;

	registerHeadersReceiveHandler(({ resourceType }, headers) => {
		//headers["access-control-allow-origin"] = ["*"];
		if (resourceType === "mainFrame" || resourceType === "subFrame") {
			headers["content-security-policy"] = [""];
		} else if (resourceType === "stylesheet") {
			// Fix hosts that don't properly set the css content type, such as raw.githubusercontent.com
			headers["content-type"] = ["text/css"];
		}
	});
	console.log(pc.red("[Firewall]"), "Set up CSP unstricter");
}

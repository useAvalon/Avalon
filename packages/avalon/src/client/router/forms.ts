/**
 * Form eligibility for client navigation.
 *
 * Native GET/POST still work as full navigations. When the router is on,
 * same-origin submissions without file inputs swap the returned HTML document.
 */

export interface FormSubmitLike {
	action: string;
	method: string;
	enctype: string | null;
	target: string | null;
	reload: boolean;
	hasFiles: boolean;
}

export interface LocationLike {
	origin: string;
	href: string;
}

export interface EligibleFormNavigation {
	url: URL;
	method: "GET" | "POST";
}

export function eligibleFormNavigation(
	form: FormSubmitLike,
	location: LocationLike,
): EligibleFormNavigation | null {
	if (form.reload) return null;
	if (form.hasFiles) return null;
	const target = form.target;
	if (target && target !== "" && target !== "_self") return null;

	const method = form.method.trim().toUpperCase();
	if (method !== "GET" && method !== "POST") return null;

	let url: URL;
	try {
		url = new URL(form.action || location.href, location.href);
	} catch {
		return null;
	}

	if (url.origin !== location.origin) return null;
	if (url.protocol !== "http:" && url.protocol !== "https:") return null;

	return { url, method };
}

export function formSubmitFromEvent(
	form: HTMLFormElement,
	submitter: HTMLElement | null,
): FormSubmitLike {
	const submitButton =
		submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement
			? submitter
			: null;

	const action =
		submitButton?.getAttribute("formaction") || form.getAttribute("action") || form.action || "";
	const method =
		submitButton?.getAttribute("formmethod") || form.getAttribute("method") || form.method || "get";
	const target = submitButton?.getAttribute("formtarget") || form.getAttribute("target");
	const reload = form.dataset.routerReload != null || submitButton?.dataset.routerReload != null;

	let hasFiles = false;
	for (const el of form.elements) {
		if (el instanceof HTMLInputElement && el.type === "file" && el.files && el.files.length > 0) {
			hasFiles = true;
			break;
		}
	}

	return {
		action,
		method,
		enctype: form.getAttribute("enctype"),
		target,
		reload,
		hasFiles,
	};
}

export function applyGetSearchParams(
	url: URL,
	form: HTMLFormElement,
	submitter: HTMLElement | null,
): URL {
	const next = new URL(url.href);
	const data =
		submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement
			? new FormData(form, submitter)
			: new FormData(form);
	next.search = "";
	for (const [key, value] of data) {
		if (typeof value !== "string") continue;
		next.searchParams.append(key, value);
	}
	return next;
}

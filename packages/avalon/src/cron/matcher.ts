/**
 * Minimal cron expression matcher used by the dev-mode scheduler.
 *
 * Production scheduling is handled by Nitro's native task runner (which uses
 * `croner`). During `vite dev` we deliberately avoid enabling Nitro's task
 * system (it would take over the SSR environment), so this lightweight matcher
 * lets Avalon fire jobs itself while keeping SSR intact.
 *
 * Supports standard 5-field (min hour dom month dow) and 6-field
 * (sec min hour dom month dow) expressions with `*`, `,`, `-`, and `/`, plus
 * the common named aliases (`@daily`, etc.).
 */

const ALIAS_MAP: Record<string, string> = {
	"@yearly": "0 0 1 1 *",
	"@annually": "0 0 1 1 *",
	"@monthly": "0 0 1 * *",
	"@weekly": "0 0 * * 0",
	"@daily": "0 0 * * *",
	"@midnight": "0 0 * * *",
	"@hourly": "0 * * * *",
};

interface FieldRange {
	min: number;
	max: number;
}

/** Resolves the numeric [start, end] range for one comma-separated field part. */
function parseRange(
	rangePart: string,
	hasStep: boolean,
	min: number,
	max: number,
): { start: number; end: number } {
	if (rangePart === "*" || rangePart === "") {
		return { start: min, end: max };
	}
	const [a, b] = rangePart.split("-");
	const start = Number.parseInt(a, 10);
	if (b !== undefined) {
		return { start, end: Number.parseInt(b, 10) };
	}
	// A bare number with a step (e.g. "5/10") ranges to the field max.
	return { start, end: hasStep ? max : start };
}

/** Parses a single cron field into the set of matching integer values. */
function parseField(field: string, { min, max }: FieldRange): Set<number> {
	const values = new Set<number>();

	for (const part of field.split(",")) {
		const [rangePart, stepPart] = part.split("/");
		const step = stepPart ? Number.parseInt(stepPart, 10) : 1;
		if (!Number.isFinite(step) || step < 1) continue;

		const { start, end } = parseRange(rangePart, stepPart !== undefined, min, max);
		if (!Number.isFinite(start) || !Number.isFinite(end)) continue;

		for (let v = start; v <= end; v += step) {
			if (v >= min && v <= max) values.add(v);
		}
	}

	return values;
}

/**
 * Returns true if the given date matches the cron expression.
 *
 * Day-of-month and day-of-week follow standard cron semantics: when both are
 * restricted (neither is `*`), a match on *either* is sufficient.
 */
export function matchesCron(expression: string, date: Date): boolean {
	const normalized = ALIAS_MAP[expression.trim()] ?? expression.trim();
	const fields = normalized.split(/\s+/);

	let sec = "0";
	let min: string;
	let hour: string;
	let dom: string;
	let month: string;
	let dow: string;

	if (fields.length === 6) {
		[sec, min, hour, dom, month, dow] = fields;
	} else if (fields.length === 5) {
		[min, hour, dom, month, dow] = fields;
	} else {
		return false;
	}

	const secondsOk = parseField(sec, { min: 0, max: 59 }).has(date.getSeconds());
	const minutesOk = parseField(min, { min: 0, max: 59 }).has(date.getMinutes());
	const hoursOk = parseField(hour, { min: 0, max: 23 }).has(date.getHours());
	const monthOk = parseField(month, { min: 1, max: 12 }).has(date.getMonth() + 1);

	const domRestricted = dom !== "*" && dom !== "?";
	const dowRestricted = dow !== "*" && dow !== "?";
	const domOk = parseField(dom === "?" ? "*" : dom, { min: 1, max: 31 }).has(date.getDate());
	// Cron day-of-week: 0-6 (Sun-Sat); also accept 7 as Sunday.
	const dowSet = parseField(dow === "?" ? "*" : dow, { min: 0, max: 7 });
	const dowOk = dowSet.has(date.getDay()) || (date.getDay() === 0 && dowSet.has(7));

	let dayOk: boolean;
	if (domRestricted && dowRestricted) {
		dayOk = domOk || dowOk;
	} else {
		dayOk = domOk && dowOk;
	}

	return secondsOk && minutesOk && hoursOk && monthOk && dayOk;
}

/** True if the expression includes a seconds field (6-field form). */
export function hasSecondsField(expression: string): boolean {
	const normalized = ALIAS_MAP[expression.trim()] ?? expression.trim();
	return normalized.split(/\s+/).length === 6;
}

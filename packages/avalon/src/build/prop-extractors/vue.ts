/** Result of prop extraction */
export interface PropExtractionResult {
	/** The TypeScript type literal for props, e.g. "{ count?: number }" */
	propsType: string;
	/** Whether extraction succeeded or fell back */
	fallback: boolean;
}

/** Fallback props type used when extraction fails or no props are found */
export const FALLBACK_PROPS = "Record<string, unknown>";

/**
 * Extract props from a Vue SFC source string.
 *
 * Looks for `defineProps<{...}>()` inside a `<script setup>` or
 * `<script setup lang="ts">` block. Uses brace-counting to handle
 * nested types within the angle brackets.
 *
 * Never throws — returns fallback on any failure.
 */
export function extractVueProps(source: string): PropExtractionResult {
	try {
		// 1. Extract the <script setup ...> block content
		const scriptContent = extractScriptSetupContent(source);
		if (scriptContent === null) {
			return { propsType: FALLBACK_PROPS, fallback: true };
		}

		// 2. Find defineProps<...>() and extract the type argument
		const propsType = extractDefinePropsType(scriptContent);
		if (propsType === null) {
			return { propsType: FALLBACK_PROPS, fallback: true };
		}

		return { propsType, fallback: false };
	} catch {
		console.warn(
			"[avalon] Failed to extract Vue props — falling back to Record<string, unknown>",
		);
		return { propsType: FALLBACK_PROPS, fallback: true };
	}
}

/**
 * Extract the content of the `<script setup>` block from a Vue SFC source.
 * Returns `null` if no `<script setup>` block is found.
 */
function extractScriptSetupContent(source: string): string | null {
	// Match <script setup> or <script setup lang="ts"> (and other attrs)
	// The 's' flag makes . match newlines
	const scriptSetupRegex =
		/<script\b[^>]*\bsetup\b[^>]*>([\s\S]*?)<\/script>/i;
	const match = new RegExp(scriptSetupRegex).exec(source);
	return match ? match[1] : null;
}

/**
 * Extract the type argument from `defineProps<TYPE>()` using angle-bracket
 * and brace counting to handle nested generics and object types.
 *
 * Returns the trimmed type string, or `null` if not found.
 */
/**
 * Extract the type argument from `defineProps<TYPE>()` using angle-bracket
 * and brace counting to handle nested generics and object types.
 *
 * Returns the trimmed type string, or `null` if not found.
 */
/**
 * Extract the type argument from `defineProps<TYPE>()` using angle-bracket
 * counting to handle nested generics and object types.
 *
 * After extraction, validates that braces are balanced in the result.
 * Returns the trimmed type string, or `null` if not found.
 */
function extractDefinePropsType(scriptContent: string): string | null {
	// Find the start of defineProps<
	const marker = "defineProps<";
	const idx = scriptContent.indexOf(marker);
	if (idx === -1) {
		return null;
	}

	const start = idx + marker.length;
	let depth = 1; // We're already past the opening <
	let i = start;

	while (i < scriptContent.length && depth > 0) {
		const ch = scriptContent[i];
		if (ch === "<") {
			depth++;
		} else if (ch === ">") {
			depth--;
		}
		if (depth > 0) {
			i++;
		}
	}

	if (depth !== 0) {
		console.warn(
			"[avalon] Unbalanced angle brackets in defineProps<...> — falling back",
		);
		return null;
	}

	const typeStr = scriptContent.slice(start, i).trim();
	if (typeStr.length === 0) {
		return null;
	}

	// Validate that braces are balanced in the extracted type
	let braceDepth = 0;
	for (const ch of typeStr) {
		if (ch === "{") braceDepth++;
		else if (ch === "}") braceDepth--;
		if (braceDepth < 0) {
			console.warn(
				"[avalon] Unbalanced braces in defineProps type — falling back",
			);
			return null;
		}
	}
	if (braceDepth !== 0) {
		console.warn(
			"[avalon] Unbalanced braces in defineProps type — falling back",
		);
		return null;
	}

	return typeStr;
}



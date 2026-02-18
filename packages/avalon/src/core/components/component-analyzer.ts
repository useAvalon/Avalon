/**
 * Component Analyzer - High-level interface for component detection system
 *
 * This module provides a convenient interface for analyzing components
 * and making hydration decisions in the SSR system.
 */

import {
	analyzeComponent,
	shouldHydrateComponent,
	createComponentMetadata,
	type ComponentAnalysis,
	type DetectionResult,
	type ComponentMetadata,
} from './component-detection.ts';

export interface AnalyzerOptions {
	forceSSROnly?: boolean;
	detectScripts?: boolean;
	suppressWarnings?: boolean;
	logDecisions?: boolean;
}

export interface AnalysisReport {
	metadata: ComponentMetadata;
	decision: DetectionResult;
	analysis: ComponentAnalysis;
}

/**
 * Analyzes a component file and returns comprehensive analysis report
 */
export async function analyzeComponentFile(filePath: string, options: AnalyzerOptions = {}): Promise<AnalysisReport> {
	try {
		// Read component file
		const { readFile } = await import('node:fs/promises');
		const content = await readFile(filePath, 'utf-8');

		// Perform analysis
		const analysis = analyzeComponent(filePath, content);
		const decision = shouldHydrateComponent(analysis, options);
		const metadata = createComponentMetadata(filePath, content, analysis);

		// Log decision if requested
		if (options.logDecisions) {
			logAnalysisDecision(filePath, analysis, decision);
		}

		return {
			metadata,
			decision,
			analysis,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to analyze component ${filePath}: ${errorMessage}`);
	}
}

/**
 * Analyzes component content directly (for in-memory components)
 */
export function analyzeComponentContent(
	filePath: string,
	content: string,
	options: AnalyzerOptions = {}
): AnalysisReport {
	const analysis = analyzeComponent(filePath, content);
	const decision = shouldHydrateComponent(analysis, options);
	const metadata = createComponentMetadata(filePath, content, analysis);

	// Log decision if requested
	if (options.logDecisions) {
		logAnalysisDecision(filePath, analysis, decision);
	}

	return {
		metadata,
		decision,
		analysis,
	};
}

/**
 * Batch analyze multiple components
 */
export async function analyzeComponents(
	filePaths: string[],
	options: AnalyzerOptions = {}
): Promise<Map<string, AnalysisReport>> {
	const results = new Map<string, AnalysisReport>();

	for (const filePath of filePaths) {
		try {
			const report = await analyzeComponentFile(filePath, options);
			results.set(filePath, report);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error(`Failed to analyze ${filePath}:`, errorMessage);
		}
	}

	return results;
}

/**
 * Quick check if a component should be hydrated
 */
export async function shouldHydrate(filePath: string, options: AnalyzerOptions = {}): Promise<boolean> {
	try {
		const report = await analyzeComponentFile(filePath, options);
		return report.decision.shouldHydrate;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`Error checking hydration for ${filePath}:`, errorMessage);
		// Default to hydration on error for safety
		return true;
	}
}

/**
 * Get component framework type
 */
export async function getComponentFramework(filePath: string): Promise<ComponentAnalysis['framework']> {
	try {
		const report = await analyzeComponentFile(filePath);
		return report.analysis.framework;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`Error detecting framework for ${filePath}:`, errorMessage);
		return 'unknown';
	}
}

/**
 * Logs analysis decision for debugging
 */
function logAnalysisDecision(filePath: string, analysis: ComponentAnalysis, decision: DetectionResult): void {
	const framework = analysis.framework.toUpperCase();
	const strategy = decision.shouldHydrate ? 'HYDRATE' : 'SSR-ONLY';

	console.log(`[Component Analysis] ${filePath}`);
	console.log(`  Framework: ${framework}`);
	console.log(`  Has Script: ${analysis.hasScript}`);
	console.log(`  Has Hydrate Function: ${analysis.hasHydrateFunction}`);
	console.log(`  Strategy: ${strategy}`);
	console.log(`  Reason: ${decision.reason}`);

	if (decision.warnings && decision.warnings.length > 0) {
		console.log(`  Warnings:`);
		decision.warnings.forEach(warning => console.log(`    - ${warning}`));
	}

	console.log('');
}

/**
 * Generate summary statistics for a batch of components
 */
export function generateAnalysisSummary(reports: Map<string, AnalysisReport>): {
	total: number;
	byFramework: Record<string, number>;
	byStrategy: Record<string, number>;
	withWarnings: number;
} {
	const summary = {
		total: reports.size,
		byFramework: {} as Record<string, number>,
		byStrategy: {} as Record<string, number>,
		withWarnings: 0,
	};

	for (const [, report] of reports) {
		// Count by framework
		const framework = report.analysis.framework;
		summary.byFramework[framework] = (summary.byFramework[framework] || 0) + 1;

		// Count by strategy
		const strategy = report.decision.shouldHydrate ? 'hydrate' : 'ssr-only';
		summary.byStrategy[strategy] = (summary.byStrategy[strategy] || 0) + 1;

		// Count warnings
		if (report.decision.warnings && report.decision.warnings.length > 0) {
			summary.withWarnings++;
		}
	}

	return summary;
}

// Export types for external use
export type { ComponentAnalysis, DetectionResult, ComponentMetadata } from './component-detection.ts';

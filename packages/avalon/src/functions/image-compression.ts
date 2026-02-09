import { join, extname, basename } from 'node:path';
import { ensureDir, exists, walk } from '../utils/std-fs-shim.ts';

/**
 * Image compression configuration type
 */
export interface ImageCompressionConfig {
	enabled: boolean;
	quality?: number;
	srcDir?: string;
	outputDir?: string;
	formats?: ('webp' | 'avif' | 'jpeg' | 'png')[];
	sizes?: Array<{
		width?: number;
		height?: number;
		suffix?: string;
	}>;
	preserveOriginal?: boolean;
}

/**
 * Supported image formats for input
 */
const SUPPORTED_INPUT_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'];

/**
 * Image processing options for a single image
 */
interface ImageProcessingOptions {
	input: string;
	output: string;
	quality?: number;
	width?: number;
	height?: number;
	format?: 'webp' | 'avif' | 'jpeg' | 'png';
}

/**
 * Convert image using Sharp for WebP conversion with proper compression
 */
async function convertToWebP(options: ImageProcessingOptions): Promise<void> {
	try {
		// Import sharp from npm
		const sharp = (await import('npm:sharp')).default;

		// Create sharp instance from input file
		let image = sharp(options.input);

		// Resize if dimensions are specified
		if (options.width || options.height) {
			image = image.resize(options.width, options.height, {
				fit: 'inside',
				withoutEnlargement: true,
			});
		}

		// Convert to WebP with proper compression
		await image
			.webp({
				quality: options.quality || 80,
				effort: 6, // Maximum compression effort
				lossless: false,
				nearLossless: false,
				smartSubsample: true,
			})
			.toFile(options.output);

		// Log file size reduction
		const inputStat = await Deno.stat(options.input);
		const outputStat = await Deno.stat(options.output);
		const reduction = Math.round((1 - outputStat.size / inputStat.size) * 100);

		const inputKB = Math.round(inputStat.size / 1024);
		const outputKB = Math.round(outputStat.size / 1024);
		const fileName = options.input.split('/').pop();

		// Bracket style compression bar
		const barLength = 15;
		const filled = Math.round((reduction / 100) * barLength);
		const empty = barLength - filled;
		const bar = '▰'.repeat(filled) + '▱'.repeat(empty);

		// avalon ASCII mini-icon (based on your ASCII art)
		const avalonIcon = '▪▫';
		console.log(`${avalonIcon} ${fileName} [${bar}] ${reduction}% ${inputKB}KB→${outputKB}KB`);
	} catch (error) {
		console.error(`❌ Failed to convert ${options.input}:`, error);
		throw error;
	}
}

/**
 * Convert image using @epi/image-to-webp for other formats
 */
async function convertWithImageToWebp(options: ImageProcessingOptions): Promise<void> {
	try {
		// For now, we'll focus on WebP conversion using the reliable deno-cwebp
		// Other formats can be added later with more robust libraries
		if (options.format === 'webp') {
			await convertToWebP(options);
			return;
		}

		// For non-WebP formats, copy the original file for now
		console.warn(`Format conversion to ${options.format} not implemented yet, copying original`);
		await Deno.copyFile(options.input, options.output);
		console.log(`📄 Copied: ${options.input} -> ${options.output}`);
	} catch (error) {
		console.error(`❌ Failed to process ${options.input}:`, error);
		throw error;
	}
}

/**
 * Process a single image file
 */
async function processImage(
	inputPath: string,
	config: Required<Exclude<ImageCompressionConfig, undefined>>,
	outputDir: string
): Promise<void> {
	const inputExt = extname(inputPath).toLowerCase();
	const baseName = basename(inputPath, inputExt);

	// Ensure output directory exists
	await ensureDir(outputDir);

	// Process each requested format
	for (const format of config.formats) {
		const outputPath = join(outputDir, `${baseName}.${format}`);

		// Skip if output already exists and is newer than input
		if (await exists(outputPath)) {
			const inputStat = await Deno.stat(inputPath);
			const outputStat = await Deno.stat(outputPath);
			if (outputStat.mtime && inputStat.mtime && outputStat.mtime > inputStat.mtime) {
				console.log(`⏭️  Skipping (already up to date): ${outputPath}`);
				continue;
			}
		}

		const processingOptions: ImageProcessingOptions = {
			input: inputPath,
			output: outputPath,
			quality: config.quality,
			format,
		};

		// Always process original size first
		if (format === 'webp') {
			await convertToWebP(processingOptions);
		} else {
			await convertWithImageToWebp(processingOptions);
		}

		// Process different sizes if specified
		if (config.sizes && config.sizes.length > 0) {
			for (const sizeConfig of config.sizes) {
				const sizeSuffix = sizeConfig.suffix || `_${sizeConfig.width || 'auto'}x${sizeConfig.height || 'auto'}`;
				const sizedOutputPath = join(outputDir, `${baseName}${sizeSuffix}.${format}`);

				const sizedOptions: ImageProcessingOptions = {
					...processingOptions,
					output: sizedOutputPath,
					width: sizeConfig.width,
					height: sizeConfig.height,
				};

				if (format === 'webp') {
					await convertToWebP(sizedOptions);
				} else {
					await convertWithImageToWebp(sizedOptions);
				}
			}
		}
	}

	// Preserve original if requested
	if (config.preserveOriginal) {
		const originalOutputPath = join(outputDir, basename(inputPath));
		if (inputPath !== originalOutputPath) {
			await Deno.copyFile(inputPath, originalOutputPath);
			console.log(`📄 Preserved original: ${originalOutputPath}`);
		}
	}
}

/**
 * Compress and convert images according to configuration
 */
export async function compressImages(config?: ImageCompressionConfig): Promise<void> {
	if (!config?.enabled) {
		console.log('🖼️  Image compression is disabled');
		return;
	}

	const fullConfig: Required<ImageCompressionConfig> = {
		enabled: config.enabled,
		quality: config.quality ?? 80,
		srcDir: config.srcDir ?? 'src/images',
		outputDir: config.outputDir ?? 'public/images',
		formats: config.formats ?? ['webp'],
		sizes: config.sizes ?? [],
		preserveOriginal: config.preserveOriginal ?? false,
	};

	console.log('\n⚡ IMAGE COMPRESSION INITIATED');
	console.log(`📂 ${fullConfig.srcDir} → ${fullConfig.outputDir}`);
	console.log(`🎯 ${fullConfig.formats.join('/')} @ ${fullConfig.quality}% quality\n`);

	// Check if source directory exists
	if (!(await exists(fullConfig.srcDir))) {
		console.log(`⚠️  No images found - creating ${fullConfig.srcDir}`);
		await ensureDir(fullConfig.srcDir);
		return;
	}

	// Ensure output directory exists
	await ensureDir(fullConfig.outputDir);

	let processedCount = 0;
	let errorCount = 0;

	// Process all images in source directory
	try {
		for await (const entry of walk(fullConfig.srcDir, {
			exts: SUPPORTED_INPUT_FORMATS,
			includeDirs: false,
		})) {
			try {
				await processImage(entry.path, fullConfig, fullConfig.outputDir);
				processedCount++;
			} catch (error) {
				console.error(`❌ Error processing ${entry.path}:`, error);
				errorCount++;
			}
		}
	} catch (error) {
		console.error('❌ Error walking source directory:', error);
		throw error;
	}

	console.log(`\n🚀 COMPRESSION COMPLETE`);
	console.log(`📊 ${processedCount} processed ${errorCount > 0 ? `${errorCount} errors` : '✓'}`);
}

/**
 * Check if required dependencies are available
 */
export async function checkImageDependencies(): Promise<{ webp: boolean; dimg: boolean }> {
	const result = { webp: false, dimg: false };

	// Check for sharp npm package
	try {
		await import('npm:sharp');
		result.webp = true;
	} catch {
		result.webp = false;
	}

	// Image processing modules should be available
	result.dimg = true; // We're using built-in Deno functionality

	return result;
}

/**
 * Install dependencies (now using npm packages, no system dependencies needed)
 */
export async function installImageDependencies(): Promise<void> {
	console.log('📦 Checking image processing dependencies...');

	const deps = await checkImageDependencies();

	if (deps.webp) {
		console.log('✅ All image processing dependencies are available');
		console.log('   Using Sharp from npm registry');
	} else {
		console.log('⚠️  WebP processing not available');
		console.log('   This usually means network connectivity issues or Deno cache problems');
		console.log('   Try running: deno cache --reload npm:sharp');
	}
}

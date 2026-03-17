/**
 * Image Component for Avalon
 *
 * A responsive image component that works with vite-imagetools to provide
 * optimized images with automatic srcset generation.
 *
 * Usage:
 * ```tsx
 * import { Image } from '@useavalon/avalon/client';
 * import heroSrc from './hero.jpg?w=400;800;1200&format=webp&as=srcset';
 *
 * <Image
 *   src={heroSrc}
 *   alt="Hero image"
 *   sizes="(max-width: 600px) 400px, (max-width: 1200px) 800px, 1200px"
 * />
 * ```
 *
 * Or with the simpler single-image approach:
 * ```tsx
 * import heroSrc from './hero.jpg?w=800&format=webp';
 *
 * <Image src={heroSrc} alt="Hero image" width={800} height={600} />
 * ```
 */

import type { JSX } from "preact";

export interface ImageProps {
  /** 
   * Image source - can be:
   * - A string URL (single image)
   * - A srcset string from ?as=srcset (contains " Xw" width descriptors)
   * - An object with src/srcset/width/height from vite-imagetools
   */
  src: string | { src: string; srcset?: string; width?: number; height?: number };

  /** Alt text for accessibility (required) */
  alt: string;

  /** Sizes attribute for responsive images (required when using srcset) */
  sizes?: string;

  /** Loading strategy */
  loading?: "lazy" | "eager";

  /** Decoding hint */
  decoding?: "async" | "sync" | "auto";

  /** Optional width (auto-detected from srcset if available) */
  width?: number | string;

  /** Optional height (auto-detected from srcset if available) */
  height?: number | string;

  /** CSS class name */
  className?: string;

  /** Inline styles */
  style?: string | Record<string, string | number>;
}

/**
 * Check if a string looks like a srcset (contains width descriptors like "400w")
 */
function isSrcsetString(value: string): boolean {
  return /\s\d+w/.test(value);
}

/**
 * Responsive image component with built-in optimization support
 */
export function Image({
  src,
  alt,
  sizes,
  loading = "lazy",
  decoding = "async",
  width,
  height,
  className,
  style,
}: Readonly<ImageProps>): JSX.Element {
  let imgSrc: string | undefined;
  let srcSet: string | undefined;
  let autoWidth: number | undefined;
  let autoHeight: number | undefined;

  if (typeof src === "object" && src !== null) {
    // Object from vite-imagetools (e.g., ?as=metadata or custom output)
    imgSrc = src.src;
    srcSet = src.srcset;
    autoWidth = src.width;
    autoHeight = src.height;
  } else if (typeof src === "string") {
    if (isSrcsetString(src)) {
      // srcset string from ?as=srcset - use first URL as fallback src
      srcSet = src;
      const firstUrl = src.split(",")[0]?.trim().split(" ")[0];
      imgSrc = firstUrl;
    } else {
      // Regular URL string
      imgSrc = src;
    }
  }

  return (
    <img
      src={imgSrc}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      loading={loading}
      decoding={decoding}
      width={width ?? autoWidth}
      height={height ?? autoHeight}
      className={className}
      style={style}
    />
  );
}

export default Image;

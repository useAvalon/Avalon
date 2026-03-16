/**
 * Type declarations for image imports with vite-imagetools
 *
 * These types enable TypeScript support for optimized image imports.
 * Include this in your tsconfig.json `types` array:
 *
 * ```json
 * {
 *   "compilerOptions": {
 *     "types": ["@avalon/avalon/types"]
 *   }
 * }
 * ```
 */

declare module "*.jpg" {
  const src: string;
  export default src;
}

declare module "*.jpeg" {
  const src: string;
  export default src;
}

declare module "*.png" {
  const src: string;
  export default src;
}

declare module "*.webp" {
  const src: string;
  export default src;
}

declare module "*.avif" {
  const src: string;
  export default src;
}

declare module "*.gif" {
  const src: string;
  export default src;
}

declare module "*.tiff" {
  const src: string;
  export default src;
}

declare module "*.svg" {
  const src: string;
  export default src;
}

// vite-imagetools srcset output
interface ImageToolsSrcset {
  src: string;
  srcset: string;
  width: number;
  height: number;
}

declare module "*&as=srcset" {
  const srcset: ImageToolsSrcset;
  export default srcset;
}

declare module "*?as=srcset" {
  const srcset: ImageToolsSrcset;
  export default srcset;
}

// vite-imagetools picture output (multiple formats)
interface ImageToolsPicture {
  sources: Record<string, ImageToolsSrcset>;
  img: ImageToolsSrcset;
}

declare module "*&as=picture" {
  const picture: ImageToolsPicture;
  export default picture;
}

declare module "*?as=picture" {
  const picture: ImageToolsPicture;
  export default picture;
}

// vite-imagetools metadata output
interface ImageToolsMetadata {
  src: string;
  width: number;
  height: number;
  format: string;
}

declare module "*&as=metadata" {
  const metadata: ImageToolsMetadata;
  export default metadata;
}

declare module "*?as=metadata" {
  const metadata: ImageToolsMetadata;
  export default metadata;
}

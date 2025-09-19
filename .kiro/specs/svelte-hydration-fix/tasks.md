# Implementation Plan

- [x] 1. Clean up unused build artifacts and directories

  - Remove the unused `public/dist-svelte-compiled` directory
  - Update build configuration to prevent regeneration of unused directories
  - Verify build process still generates all necessary assets
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Remove unimplemented on:load directive support

  - Remove `on:load` handling from the hydration client script
  - Update directive detection to ignore `on:load` completely
  - Add warning logging when `on:load` is encountered
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3. Implement proper on:idle functionality with fallbacks

  - Enhance `setupIdleTrigger` function to use `requestIdleCallback` properly
  - Add fallback to document load event when `requestIdleCallback` is not supported
  - Implement timeout mechanism for cases where browser never becomes idle
  - Add queuing system for multiple components using `on:idle`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Add configurable rootMargin support for on:visible directive

  - Modify `setupVisibilityTrigger` to parse rootMargin from directive options
  - Implement parsing for syntax like `on:visible={{rootMargin: "50px"}}`
  - Add validation and fallback for invalid rootMargin values
  - Update Intersection Observer configuration to use parsed rootMargin
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 5. Implement component script detection system

  - Create utility functions to detect script sections in components
  - Add framework-specific detection for Vue, Svelte, and Solid components
  - Implement logic to check for presence of hydrate functions
  - Create component analysis interface and return structured detection results
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 6. Add SSR-only rendering support without hydration errors

  - Modify hydration client to gracefully handle components without hydrate functions
  - Update error handling to show informative warnings instead of errors for SSR-only components
  - Implement detection logic to automatically determine if component needs hydration
  - Add logging for chosen rendering strategy to aid debugging
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.5_

- [x] 7. Update SSR system to support intelligent rendering strategy detection

  - Integrate component detection system into SSR rendering process
  - Add logic to skip hydration attribute generation for SSR-only components
  - Implement configuration options for forcing SSR-only rendering
  - Update component metadata generation to include rendering strategy
  - _Requirements: 5.1, 5.3, 5.4, 6.1, 6.2, 6.3_

- [x] 8. Enhance hydration client with improved option parsing
  - Update directive parsing to handle complex option objects
  - Add validation for hydration options like rootMargin and timeout
  - Implement fallback values for malformed or missing options
  - Add debug logging for parsed hydration configurations
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 3.5_

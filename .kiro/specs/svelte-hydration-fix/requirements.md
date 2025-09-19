# Requirements Document

## Introduction

This feature addresses multiple issues in the current hydration system for the framework. The goal is to clean up unused build artifacts, remove unimplemented directives, enhance existing hydration controls, and support SSR-only rendering without hydration errors. These improvements will make the framework more robust and user-friendly for consumers who need flexible rendering options.

## Requirements

### Requirement 1

**User Story:** As a framework consumer, I want unused build artifacts removed so that my project doesn't include unnecessary files.

#### Acceptance Criteria

1. WHEN the build process runs THEN the system SHALL NOT generate unused `dist-svelte-compiled` directories
2. WHEN examining the public directory THEN there SHALL be no orphaned compiled assets that aren't being served
3. WHEN the build completes THEN only actively used build outputs SHALL remain in the file system

### Requirement 2

**User Story:** As a developer, I want only implemented hydration directives available so that I don't encounter confusing unimplemented features.

#### Acceptance Criteria

1. WHEN using hydration directives THEN the system SHALL NOT accept `on:load` as a valid directive
2. WHEN `on:load` is encountered THEN the system SHALL treat it as an error or ignore it completely
3. WHEN documenting hydration options THEN `on:load` SHALL NOT be listed as an available option
4. WHEN the framework processes components THEN only `on:client`, `on:visible`, and `on:idle` SHALL be recognized

### Requirement 3

**User Story:** As a developer, I want proper `on:idle` functionality so that I can defer hydration of lower-priority components until the browser is idle.

#### Acceptance Criteria

1. WHEN `on:idle` directive is used THEN the system SHALL use `requestIdleCallback` if available
2. WHEN `requestIdleCallback` is not supported THEN the system SHALL fall back to the document load event
3. WHEN the page completes initial load AND the browser becomes idle THEN components with `on:idle` SHALL be hydrated
4. WHEN multiple components use `on:idle` THEN they SHALL be queued and hydrated during idle periods
5. WHEN the browser never becomes idle THEN components SHALL still hydrate after a reasonable timeout

### Requirement 4

**User Story:** As a developer, I want to control the root margin for `on:visible` hydration so that I can fine-tune when components become visible.

#### Acceptance Criteria

1. WHEN using `on:visible` directive THEN the system SHALL accept a `rootMargin` parameter
2. WHEN `rootMargin` is specified THEN the system SHALL pass it to the Intersection Observer
3. WHEN `rootMargin` is not specified THEN the system SHALL use a sensible default value
4. WHEN `rootMargin` is invalid THEN the system SHALL fall back to the default and log a warning
5. WHEN using syntax like `on:visible={{rootMargin: "50px"}}` THEN the system SHALL parse and apply the margin correctly

### Requirement 5

**User Story:** As a framework consumer, I want to render components with SSR only (no hydration) so that I can use the framework for static content without JavaScript overhead.

#### Acceptance Criteria

1. WHEN a component has no script section THEN the system SHALL render it with SSR only and not attempt hydration
2. WHEN a component has a script section but no hydrate function THEN the system SHALL render with SSR and optionally warn about missing hydration
3. WHEN a component is intended for SSR-only THEN the system SHALL NOT generate client-side JavaScript for it
4. WHEN detecting hydration capability THEN the system SHALL check for the presence of script tags or hydrate functions
5. WHEN SSR-only rendering is used THEN the system SHALL NOT produce hydration errors or warnings for components without scripts
6. WHEN a component has scripts but is marked for SSR-only THEN the system SHALL respect that choice and skip hydration

### Requirement 6

**User Story:** As a framework consumer, I want clear detection of hydration requirements so that the system can automatically determine rendering strategy.

#### Acceptance Criteria

1. WHEN analyzing a component THEN the system SHALL detect if it contains interactive script code
2. WHEN a component has script tags THEN the system SHALL assume it needs hydration unless explicitly configured otherwise
3. WHEN a component has no script tags THEN the system SHALL default to SSR-only rendering
4. WHEN the detection is ambiguous THEN the system SHALL provide clear feedback to the developer
5. WHEN components are processed THEN the system SHALL log the chosen rendering strategy for debugging

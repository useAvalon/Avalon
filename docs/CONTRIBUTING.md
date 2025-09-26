# Contributing to Avalon Documentation

Thank you for your interest in contributing to the Avalon documentation! This guide will help you get started with contributing to our comprehensive documentation system.

## Getting Started

### Prerequisites

- Deno 2.5+ installed
- Basic knowledge of Markdown
- Familiarity with TypeScript/JavaScript (for code examples)

### Development Setup

1. Clone the repository
2. Navigate to the docs directory: `cd docs`
3. Start the development server: `deno task dev`
4. Open http://localhost:3001 in your browser

## Documentation Structure

Our documentation follows a six-section structure:

- **01-getting-started/** - Onboarding and quick wins
- **02-core-concepts/** - Fundamental understanding
- **03-features/** - Detailed feature guides
- **04-api-reference/** - Complete API documentation
- **05-guides/** - Best practices and patterns
- **06-migration/** - Framework comparisons and migration

## Writing Guidelines

### Markdown Format

All documentation is written in Markdown with frontmatter:

```markdown
---
title: 'Page Title'
description: 'Brief description for SEO'
section: 'getting-started'
order: 1
tags: ['tag1', 'tag2']
difficulty: 'beginner'
---

# Page Title

Content goes here...
```

### Code Examples

Use fenced code blocks with language specification:

```typescript
// TypeScript example
interface MyInterface {
	prop: string;
}
```

For runnable examples, add the `runnable` attribute:

```typescript runnable
// This code can be executed in the browser
console.log('Hello, Avalon!');
```

For framework-specific examples, specify the framework:

```tsx framework="preact"
import { useState } from 'preact/hooks';

export function Counter() {
	const [count, setCount] = useState(0);
	return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

### Style Guidelines

1. **Clear and Concise**: Write in clear, simple language
2. **Example-Driven**: Include practical examples for every concept
3. **Progressive Disclosure**: Start simple, add complexity gradually
4. **Accessibility**: Use proper heading hierarchy and alt text
5. **Mobile-Friendly**: Ensure content works on all screen sizes

### Code Validation

All code examples are automatically validated during the build process. Ensure your examples:

- Compile without errors
- Use correct imports
- Follow TypeScript best practices
- Work with the current Avalon version

## Building and Testing

### Development Server

```bash
deno task dev
```

Starts a development server with hot reloading at http://localhost:3001

### Build Documentation

```bash
deno task build
```

Builds the static documentation site to the `dist` directory.

### Validation

```bash
deno task check
```

Validates all code examples and checks for broken links.

## Contribution Process

1. **Fork the Repository**: Create your own fork of the Avalon repository
2. **Create a Branch**: Create a feature branch for your changes
3. **Make Changes**: Add or update documentation following our guidelines
4. **Test Locally**: Run the development server and validate your changes
5. **Submit PR**: Create a pull request with a clear description

### Pull Request Guidelines

- **Clear Title**: Use a descriptive title for your PR
- **Description**: Explain what you changed and why
- **Screenshots**: Include screenshots for visual changes
- **Testing**: Confirm all code examples work
- **Links**: Test all internal and external links

## Content Types

### Tutorials

Step-by-step guides that teach specific skills:

- Clear learning objectives
- Prerequisites listed
- Step-by-step instructions
- Working code examples
- What's next section

### Reference Documentation

Complete technical reference:

- Generated from TypeScript definitions
- Complete parameter descriptions
- Usage examples
- Related concepts linked

### Guides

Best practices and patterns:

- Real-world scenarios
- Before/after examples
- Performance considerations
- Common pitfalls

### Examples

Practical code examples:

- Complete, working code
- Multiple framework variants
- Commented explanations
- Runnable in browser

## Review Process

All contributions go through a review process:

1. **Automated Checks**: Code validation and link checking
2. **Technical Review**: Accuracy and completeness
3. **Editorial Review**: Clarity and style
4. **Final Approval**: Maintainer approval

## Getting Help

- **Discord**: Join our community Discord for real-time help
- **GitHub Issues**: Report bugs or request features
- **Discussions**: Ask questions in GitHub Discussions

## Recognition

Contributors are recognized in:

- Documentation credits
- Release notes
- Community highlights

Thank you for helping make Avalon's documentation better for everyone!

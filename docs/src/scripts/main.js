// Main documentation JavaScript

document.addEventListener('DOMContentLoaded', function () {
	initializeNavigation();
	initializeCodeBlocks();
	initializeSearch();
	initializeMobileMenu();
});

/**
 * Initialize navigation functionality
 */
function initializeNavigation() {
	// Highlight current page in navigation
	const currentPath = window.location.pathname;
	const navLinks = document.querySelectorAll('.nav-link');

	navLinks.forEach(link => {
		if (link.getAttribute('href') === currentPath) {
			link.closest('.nav-link-container').classList.add('active');

			// Expand parent sections
			let parent = link.closest('.nav-children');
			while (parent) {
				parent.classList.add('expanded');
				const toggle = parent.previousElementSibling?.querySelector('.nav-toggle');
				if (toggle) {
					toggle.classList.add('expanded');
					toggle.setAttribute('aria-expanded', 'true');
				}
				parent = parent.parentElement.closest('.nav-children');
			}
		}
	});

	// Handle navigation toggles
	const toggles = document.querySelectorAll('.nav-toggle');
	toggles.forEach(toggle => {
		toggle.addEventListener('click', function () {
			const children = this.closest('.nav-link-container').nextElementSibling;
			const isExpanded = children.classList.contains('expanded');

			children.classList.toggle('expanded');
			this.classList.toggle('expanded');
			this.setAttribute('aria-expanded', !isExpanded);
		});
	});
}

/**
 * Initialize code block functionality
 */
function initializeCodeBlocks() {
	// Add copy buttons to code blocks
	const codeBlocks = document.querySelectorAll('pre code');

	codeBlocks.forEach(codeBlock => {
		const pre = codeBlock.parentElement;
		const container = document.createElement('div');
		container.className = 'code-block-container';

		// Wrap the pre element
		pre.parentNode.insertBefore(container, pre);
		container.appendChild(pre);

		// Add copy button
		const copyButton = document.createElement('button');
		copyButton.className = 'copy-button';
		copyButton.textContent = 'Copy';
		copyButton.setAttribute('aria-label', 'Copy code to clipboard');

		copyButton.addEventListener('click', async function () {
			try {
				await navigator.clipboard.writeText(codeBlock.textContent);
				this.textContent = 'Copied!';
				setTimeout(() => {
					this.textContent = 'Copy';
				}, 2000);
			} catch (err) {
				console.error('Failed to copy code:', err);
				this.textContent = 'Failed';
				setTimeout(() => {
					this.textContent = 'Copy';
				}, 2000);
			}
		});

		container.appendChild(copyButton);
	});

	// Handle runnable examples
	const runnableExamples = document.querySelectorAll('.runnable-example');
	runnableExamples.forEach(example => {
		const runButton = example.querySelector('.run-button');
		const codeElement = example.querySelector('code');
		const preview = example.querySelector('.runnable-example-preview');

		if (runButton && codeElement && preview) {
			runButton.addEventListener('click', function () {
				runCodeExample(codeElement.textContent, preview);
			});
		}
	});
}

/**
 * Run code example in preview area
 */
function runCodeExample(code, previewElement) {
	try {
		// This is a simplified example runner
		// In a full implementation, this would handle different frameworks

		if (code.includes('function') || code.includes('=>')) {
			// Try to execute JavaScript
			const result = eval(code);
			previewElement.innerHTML = `<div class="result">${result}</div>`;
		} else if (code.includes('<')) {
			// Treat as HTML
			previewElement.innerHTML = code;
		} else {
			previewElement.innerHTML = `<pre>${code}</pre>`;
		}
	} catch (error) {
		previewElement.innerHTML = `<div class="error">Error: ${error.message}</div>`;
	}
}

/**
 * Initialize search functionality
 */
function initializeSearch() {
	const searchInput = document.querySelector('.search-input');
	if (!searchInput) return;

	let searchTimeout;

	searchInput.addEventListener('input', function () {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			performSearch(this.value);
		}, 300);
	});

	// Handle search keyboard shortcuts
	document.addEventListener('keydown', function (e) {
		if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
			e.preventDefault();
			searchInput.focus();
		}

		if (e.key === 'Escape' && document.activeElement === searchInput) {
			searchInput.blur();
			hideSearchResults();
		}
	});
}

/**
 * Perform search across documentation
 */
function performSearch(query) {
	if (!query.trim()) {
		hideSearchResults();
		return;
	}

	// This is a simplified search implementation
	// In a full implementation, this would use a proper search index

	const results = [];
	const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
	const paragraphs = document.querySelectorAll('p');

	// Search headings
	headings.forEach(heading => {
		if (heading.textContent.toLowerCase().includes(query.toLowerCase())) {
			results.push({
				title: heading.textContent,
				url: `#${heading.id}`,
				type: 'heading',
				context: heading.textContent,
			});
		}
	});

	// Search paragraphs
	paragraphs.forEach(paragraph => {
		if (paragraph.textContent.toLowerCase().includes(query.toLowerCase())) {
			const context = paragraph.textContent.substring(0, 150) + '...';
			results.push({
				title: 'Content match',
				url: '#',
				type: 'content',
				context: context,
			});
		}
	});

	showSearchResults(results);
}

/**
 * Show search results
 */
function showSearchResults(results) {
	let resultsContainer = document.querySelector('.search-results');

	if (!resultsContainer) {
		resultsContainer = document.createElement('div');
		resultsContainer.className = 'search-results';
		document.querySelector('.search-container').appendChild(resultsContainer);
	}

	if (results.length === 0) {
		resultsContainer.innerHTML = '<div class="no-results">No results found</div>';
	} else {
		const html = results
			.map(
				result => `
      <div class="search-result">
        <a href="${result.url}" class="search-result-link">
          <div class="search-result-title">${result.title}</div>
          <div class="search-result-context">${result.context}</div>
        </a>
      </div>
    `
			)
			.join('');

		resultsContainer.innerHTML = html;
	}

	resultsContainer.style.display = 'block';
}

/**
 * Hide search results
 */
function hideSearchResults() {
	const resultsContainer = document.querySelector('.search-results');
	if (resultsContainer) {
		resultsContainer.style.display = 'none';
	}
}

/**
 * Initialize mobile menu functionality
 */
function initializeMobileMenu() {
	const mobileButton = document.querySelector('.mobile-menu-button');
	const navMenu = document.querySelector('.nav-menu');
	const overlay = document.querySelector('.mobile-overlay');

	if (!mobileButton || !navMenu) return;

	mobileButton.addEventListener('click', function () {
		const isOpen = navMenu.classList.contains('mobile-open');

		if (isOpen) {
			closeMobileMenu();
		} else {
			openMobileMenu();
		}
	});

	if (overlay) {
		overlay.addEventListener('click', closeMobileMenu);
	}

	// Close mobile menu when clicking nav links
	const navLinks = document.querySelectorAll('.nav-link');
	navLinks.forEach(link => {
		link.addEventListener('click', closeMobileMenu);
	});

	// Handle escape key
	document.addEventListener('keydown', function (e) {
		if (e.key === 'Escape' && navMenu.classList.contains('mobile-open')) {
			closeMobileMenu();
		}
	});
}

function openMobileMenu() {
	const navMenu = document.querySelector('.nav-menu');
	const mobileButton = document.querySelector('.mobile-menu-button');

	navMenu.classList.add('mobile-open');
	mobileButton.setAttribute('aria-expanded', 'true');
	document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
	const navMenu = document.querySelector('.nav-menu');
	const mobileButton = document.querySelector('.mobile-menu-button');

	navMenu.classList.remove('mobile-open');
	mobileButton.setAttribute('aria-expanded', 'false');
	document.body.style.overflow = '';
}

/**
 * Smooth scrolling for anchor links
 */
document.addEventListener('click', function (e) {
	if (e.target.matches('a[href^="#"]')) {
		e.preventDefault();
		const target = document.querySelector(e.target.getAttribute('href'));
		if (target) {
			target.scrollIntoView({
				behavior: 'smooth',
				block: 'start',
			});
		}
	}
});

/**
 * Add scroll-to-top functionality
 */
function addScrollToTop() {
	const button = document.createElement('button');
	button.className = 'scroll-to-top';
	button.innerHTML = '↑';
	button.setAttribute('aria-label', 'Scroll to top');
	button.style.display = 'none';

	document.body.appendChild(button);

	window.addEventListener('scroll', function () {
		if (window.pageYOffset > 300) {
			button.style.display = 'block';
		} else {
			button.style.display = 'none';
		}
	});

	button.addEventListener('click', function () {
		window.scrollTo({
			top: 0,
			behavior: 'smooth',
		});
	});
}

// Initialize scroll to top
addScrollToTop();

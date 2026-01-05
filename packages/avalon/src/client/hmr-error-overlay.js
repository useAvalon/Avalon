/**
 * HMR Error Overlay
 * 
 * Provides detailed error feedback when HMR fails for island components.
 * Displays file paths, error details, and suggestions for fixing issues.
 */

/**
 * Create and show the HMR error overlay
 * @param {Object} options - Error options
 * @param {string} options.framework - The framework name
 * @param {string} options.src - The component source path
 * @param {Error} options.error - The error that occurred
 * @param {string} [options.filePath] - The full file path (if available)
 * @param {number} [options.line] - The line number (if available)
 * @param {number} [options.column] - The column number (if available)
 */
export function showHMRErrorOverlay({ framework, src, error, filePath, line, column }) {
  // Remove existing overlay
  removeHMRErrorOverlay();

  const overlay = document.createElement('div');
  overlay.id = 'avalon-hmr-error-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    backdrop-filter: blur(4px);
  `;

  const container = document.createElement('div');
  container.style.cssText = `
    background: #1a1a2e;
    border-radius: 12px;
    max-width: 700px;
    width: 90%;
    max-height: 80vh;
    overflow: auto;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    background: linear-gradient(135deg, #e74c3c, #c0392b);
    padding: 16px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-radius: 12px 12px 0 0;
  `;

  const title = document.createElement('div');
  title.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    color: white;
    font-weight: 600;
    font-size: 16px;
  `;
  title.innerHTML = `
    <span style="font-size: 20px;">⚠️</span>
    <span>HMR Update Failed</span>
  `;

  const closeBtn = document.createElement('button');
  closeBtn.style.cssText = `
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
  `;
  closeBtn.textContent = '×';
  closeBtn.onmouseover = () => closeBtn.style.background = 'rgba(255, 255, 255, 0.3)';
  closeBtn.onmouseout = () => closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
  closeBtn.onclick = removeHMRErrorOverlay;

  header.appendChild(title);
  header.appendChild(closeBtn);

  // Content
  const content = document.createElement('div');
  content.style.cssText = `
    padding: 20px;
    color: #e0e0e0;
  `;

  // File info section
  const fileInfo = document.createElement('div');
  fileInfo.style.cssText = `
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    font-size: 13px;
  `;

  const displayPath = filePath || src;
  const locationInfo = line ? `:${line}${column ? `:${column}` : ''}` : '';
  
  fileInfo.innerHTML = `
    <div style="color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
      Component
    </div>
    <div style="color: #61dafb; word-break: break-all;">
      ${escapeHtml(displayPath)}${locationInfo}
    </div>
    <div style="margin-top: 8px; color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
      Framework
    </div>
    <div style="color: #a78bfa;">
      ${escapeHtml(framework)}
    </div>
  `;

  // Error message section
  const errorSection = document.createElement('div');
  errorSection.style.cssText = `
    margin-bottom: 16px;
  `;

  const errorLabel = document.createElement('div');
  errorLabel.style.cssText = `
    color: #888;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  `;
  errorLabel.textContent = 'Error Message';

  const errorMessage = document.createElement('div');
  errorMessage.style.cssText = `
    background: rgba(231, 76, 60, 0.1);
    border: 1px solid rgba(231, 76, 60, 0.3);
    border-radius: 8px;
    padding: 12px 16px;
    color: #ff6b6b;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    font-size: 13px;
    white-space: pre-wrap;
    word-break: break-word;
  `;
  errorMessage.textContent = error.message || String(error);

  errorSection.appendChild(errorLabel);
  errorSection.appendChild(errorMessage);

  // Stack trace section (if available)
  if (error.stack) {
    const stackSection = document.createElement('div');
    stackSection.style.cssText = `
      margin-bottom: 16px;
    `;

    const stackLabel = document.createElement('div');
    stackLabel.style.cssText = `
      color: #888;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    `;

    const stackLabelText = document.createElement('span');
    stackLabelText.textContent = 'Stack Trace';

    const toggleBtn = document.createElement('button');
    toggleBtn.style.cssText = `
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: #888;
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
    `;
    toggleBtn.textContent = 'Show';

    stackLabel.appendChild(stackLabelText);
    stackLabel.appendChild(toggleBtn);

    const stackTrace = document.createElement('div');
    stackTrace.style.cssText = `
      background: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      padding: 12px 16px;
      color: #888;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 11px;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 200px;
      overflow: auto;
      display: none;
    `;
    stackTrace.textContent = formatStackTrace(error.stack);

    toggleBtn.onclick = () => {
      const isHidden = stackTrace.style.display === 'none';
      stackTrace.style.display = isHidden ? 'block' : 'none';
      toggleBtn.textContent = isHidden ? 'Hide' : 'Show';
    };

    stackSection.appendChild(stackLabel);
    stackSection.appendChild(stackTrace);
    content.appendChild(stackSection);
  }

  // Suggestions section
  const suggestions = getSuggestions(error, framework);
  if (suggestions.length > 0) {
    const suggestionsSection = document.createElement('div');
    suggestionsSection.style.cssText = `
      background: rgba(46, 204, 113, 0.1);
      border: 1px solid rgba(46, 204, 113, 0.3);
      border-radius: 8px;
      padding: 12px 16px;
    `;

    const suggestionsLabel = document.createElement('div');
    suggestionsLabel.style.cssText = `
      color: #2ecc71;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    `;
    suggestionsLabel.innerHTML = '<span>💡</span><span>Suggestions</span>';

    const suggestionsList = document.createElement('ul');
    suggestionsList.style.cssText = `
      margin: 0;
      padding-left: 20px;
      color: #a0a0a0;
      font-size: 13px;
      line-height: 1.6;
    `;

    for (const suggestion of suggestions) {
      const li = document.createElement('li');
      li.textContent = suggestion;
      suggestionsList.appendChild(li);
    }

    suggestionsSection.appendChild(suggestionsLabel);
    suggestionsSection.appendChild(suggestionsList);
    content.appendChild(suggestionsSection);
  }

  // Footer
  const footer = document.createElement('div');
  footer.style.cssText = `
    padding: 12px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: #666;
  `;

  const timestamp = document.createElement('span');
  timestamp.textContent = `${new Date().toLocaleTimeString()}`;

  const actions = document.createElement('div');
  actions.style.cssText = `
    display: flex;
    gap: 8px;
  `;

  const reloadBtn = document.createElement('button');
  reloadBtn.style.cssText = `
    background: #3498db;
    border: none;
    color: white;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
  `;
  reloadBtn.textContent = 'Reload Page';
  reloadBtn.onclick = () => globalThis.location.reload();

  const dismissBtn = document.createElement('button');
  dismissBtn.style.cssText = `
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: #888;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
  `;
  dismissBtn.textContent = 'Dismiss';
  dismissBtn.onclick = removeHMRErrorOverlay;

  actions.appendChild(dismissBtn);
  actions.appendChild(reloadBtn);

  footer.appendChild(timestamp);
  footer.appendChild(actions);

  // Assemble
  content.insertBefore(fileInfo, content.firstChild);
  content.insertBefore(errorSection, content.children[1]);

  container.appendChild(header);
  container.appendChild(content);
  container.appendChild(footer);
  overlay.appendChild(container);

  // Add keyboard handler
  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      removeHMRErrorOverlay();
    }
  };
  document.addEventListener('keydown', handleKeydown);
  overlay._keydownHandler = handleKeydown;

  document.body.appendChild(overlay);
}

/**
 * Remove the HMR error overlay
 */
export function removeHMRErrorOverlay() {
  const overlay = document.getElementById('avalon-hmr-error-overlay');
  if (overlay) {
    if (overlay._keydownHandler) {
      document.removeEventListener('keydown', overlay._keydownHandler);
    }
    overlay.remove();
  }
}

/**
 * Escape HTML special characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Format stack trace for display
 * @param {string} stack - Raw stack trace
 * @returns {string} Formatted stack trace
 */
function formatStackTrace(stack) {
  return stack
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
}

/**
 * Get suggestions based on the error
 * @param {Error} error - The error
 * @param {string} framework - The framework name
 * @returns {string[]} Array of suggestions
 */
function getSuggestions(error, framework) {
  const suggestions = [];
  const message = error.message?.toLowerCase() || '';

  // Common error patterns
  if (message.includes('no default export')) {
    suggestions.push('Ensure your component has a default export');
    suggestions.push('Check that the export statement is correct: export default ComponentName');
  }

  if (message.includes('cannot find module') || message.includes('module not found')) {
    suggestions.push('Check that the import path is correct');
    suggestions.push('Verify the file exists at the specified location');
    suggestions.push('Check for typos in the file name or path');
  }

  if (message.includes('syntax error') || message.includes('unexpected token')) {
    suggestions.push('Check for syntax errors in your component');
    suggestions.push('Ensure all brackets and parentheses are properly closed');
  }

  if (message.includes('hydration') || message.includes('mismatch')) {
    suggestions.push('Ensure server and client render the same initial content');
    suggestions.push('Check for browser-only code that runs during SSR');
  }

  // Framework-specific suggestions
  switch (framework) {
    case 'vue':
      if (message.includes('template')) {
        suggestions.push('Check your Vue template syntax');
      }
      break;
    case 'svelte':
      if (message.includes('compile')) {
        suggestions.push('Check your Svelte component syntax');
        suggestions.push('Ensure reactive statements use $: prefix');
      }
      break;
    case 'solid':
      if (message.includes('signal') || message.includes('reactive')) {
        suggestions.push('Check your Solid.js signal usage');
      }
      break;
    case 'lit':
      if (message.includes('custom element') || message.includes('define')) {
        suggestions.push('Ensure your Lit element is properly decorated with @customElement');
      }
      break;
  }

  // Generic suggestions if none matched
  if (suggestions.length === 0) {
    suggestions.push('Check the browser console for more details');
    suggestions.push('Try reloading the page');
  }

  return suggestions;
}

/**
 * Show a toast notification for HMR events
 * @param {Object} options - Toast options
 * @param {string} options.message - The message to display
 * @param {string} [options.type='info'] - The type: 'success', 'error', 'info'
 * @param {number} [options.duration=3000] - Duration in milliseconds
 */
export function showHMRToast({ message, type = 'info', duration = 3000 }) {
  // Remove existing toast
  const existing = document.getElementById('avalon-hmr-toast');
  if (existing) {
    existing.remove();
  }

  const colors = {
    success: { bg: '#2ecc71', icon: '✓' },
    error: { bg: '#e74c3c', icon: '✕' },
    info: { bg: '#3498db', icon: 'ℹ' },
  };

  const { bg, icon } = colors[type] || colors.info;

  const toast = document.createElement('div');
  toast.id = 'avalon-hmr-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${bg};
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 99998;
    animation: slideIn 0.3s ease;
  `;

  toast.innerHTML = `
    <span style="font-weight: bold;">${icon}</span>
    <span>${escapeHtml(message)}</span>
  `;

  // Add animation styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;
  toast.appendChild(style);

  document.body.appendChild(toast);

  // Auto-remove after duration
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

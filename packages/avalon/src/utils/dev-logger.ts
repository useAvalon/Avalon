/**
 * Dev-Only Logging Utilities
 * 
 * These functions provide environment-aware logging that only outputs in development mode.
 * In production (NODE_ENV=production), all logging is suppressed for better performance.
 * 
 * @module dev-logger
 */

// ============================================================================
// Environment Detection
// ============================================================================

/**
 * Check if we're in development mode
 * Returns true if NODE_ENV is not set to "production"
 */
export function isDev(): boolean {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return true; // Default to dev mode if we can't check
  }
}

/**
 * Check if verbose logging is enabled
 * Returns true only if AVALON_VERBOSE=1 is set
 */
export function isVerbose(): boolean {
  try {
    return process.env.AVALON_VERBOSE === "1";
  } catch {
    return false;
  }
}

// ============================================================================
// Dev-Only Logging Functions
// ============================================================================

/**
 * Log a message only in development mode AND when AVALON_VERBOSE=1 is set.
 * By default this is a no-op — set AVALON_VERBOSE=1 to enable diagnostic output.
 * 
 * @param args - Arguments to pass to console.log
 */
export function devLog(...args: unknown[]): void {
  if (isDev() && isVerbose()) {
    console.log(...args);
  }
}

/**
 * Log a warning only in development mode
 * In production, this is a no-op for performance
 * 
 * @param args - Arguments to pass to console.warn
 */
export function devWarn(...args: unknown[]): void {
  if (isDev()) {
    console.warn(...args);
  }
}

/**
 * Log an error only in development mode
 * In production, this is a no-op for performance
 * 
 * @param args - Arguments to pass to console.error
 */
export function devError(...args: unknown[]): void {
  if (isDev()) {
    console.error(...args);
  }
}

// ============================================================================
// Performance Tracking
// ============================================================================

/** Default threshold for slow render warnings (in milliseconds) */
const DEFAULT_SLOW_RENDER_THRESHOLD = 100;

/**
 * Log render timing information for an island component
 * Only logs in development mode
 * Warns when render time exceeds the threshold
 * 
 * @param src - The island source path
 * @param durationMs - The render duration in milliseconds
 * @param threshold - Optional threshold for slow render warning (default: 100ms)
 */
export function logRenderTiming(
  src: string, 
  durationMs: number, 
  threshold: number = DEFAULT_SLOW_RENDER_THRESHOLD
): void {
  if (!isDev()) return;
  
  if (durationMs > threshold) {
    console.warn(`⚠️ Slow island render: ${src} took ${durationMs.toFixed(2)}ms`);
  } else if (isVerbose()) {
    console.log(`🏝️ ${src} rendered in ${durationMs.toFixed(2)}ms`);
  }
}

/**
 * Log a cache hit event (dev mode only)
 * 
 * @param cacheType - The type of cache (e.g., 'analysis', 'path', 'framework')
 * @param key - The cache key that was hit
 */
export function logCacheHit(cacheType: string, key: string): void {
  if (!isDev() || !isVerbose()) return;
  console.log(`📦 Cache HIT [${cacheType}]: ${key}`);
}

/**
 * Log a cache miss event (dev mode only)
 * 
 * @param cacheType - The type of cache (e.g., 'analysis', 'path', 'framework')
 * @param key - The cache key that was missed
 */
export function logCacheMiss(cacheType: string, key: string): void {
  if (!isDev() || !isVerbose()) return;
  console.log(`📭 Cache MISS [${cacheType}]: ${key}`);
}

// ============================================================================
// DevLogger Class (for Development Server UI)
// ============================================================================

const AVALON_ASCII = `
 █████╗ ██╗   ██╗ █████╗ ██╗      ██████╗ ███╗   ██╗
██╔══██╗██║   ██║██╔══██╗██║     ██╔═══██╗████╗  ██║
███████║██║   ██║███████║██║     ██║   ██║██╔██╗ ██║
██╔══██║╚██╗ ██╔╝██╔══██║██║     ██║   ██║██║╚██╗██║
██║  ██║ ╚████╔╝ ██║  ██║███████╗╚██████╔╝██║ ╚████║
╚═╝  ╚═╝  ╚═══╝  ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝  ╚═══╝
`;

const COLORS = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

interface DevTask {
  name: string;
  status: 'pending' | 'running' | 'done';
  startTime?: number;
}

export class DevLogger {
  private readonly tasks: Map<string, DevTask> = new Map();
  private spinnerInterval?: ReturnType<typeof setInterval>;
  private currentFrame = 0;
  private readonly startTime = Date.now();
  private readonly originalConsoleLog: typeof console.log;
  private readonly originalConsoleWarn: typeof console.warn;
  private readonly originalConsoleError: typeof console.error;
  private readonly suppressedLogs: string[] = [];
  private readonly headerLines: number = 0;

  constructor() {
    this.originalConsoleLog = console.log;
    this.originalConsoleWarn = console.warn;
    this.originalConsoleError = console.error;
    
    this.suppressConsole();
    
    // Clear screen once at start
    process.stdout.write('\x1b[2J\x1b[H');
    
    const header = COLORS.cyan + AVALON_ASCII + COLORS.reset + '\n' +
                   COLORS.gray + '  Development Server' + COLORS.reset + '\n\n';
    this.headerLines = AVALON_ASCII.split('\n').length + 2;
    
    process.stdout.write(header);
  }

  private suppressConsole() {
    console.log = (...args: unknown[]) => {
      this.suppressedLogs.push(args.map(String).join(' '));
    };
    console.warn = (...args: unknown[]) => {
      this.suppressedLogs.push('[WARN] ' + args.map(String).join(' '));
    };
    console.error = this.originalConsoleError;
  }

  restoreConsole() {
    console.log = this.originalConsoleLog;
    console.warn = this.originalConsoleWarn;
    console.error = this.originalConsoleError;
  }



  addTask(id: string, name: string) {
    this.tasks.set(id, { name, status: 'pending' });
    this.render();
  }

  startTask(id: string) {
    const task = this.tasks.get(id);
    if (task) {
      task.status = 'running';
      task.startTime = Date.now();
      this.render();
    }
  }

  completeTask(id: string) {
    const task = this.tasks.get(id);
    if (task) {
      task.status = 'done';
      this.render();
    }
  }


  private render() {
    let currentTask: DevTask | null = null;
    for (const task of this.tasks.values()) {
      if (task.status === 'running') {
        currentTask = task;
        break;
      }
    }
    
    // Use carriage return to overwrite the same line
    let output = '\r'; // Return to start of line
    
    if (currentTask) {
      const spinner = COLORS.cyan + SPINNER_FRAMES[this.currentFrame] + COLORS.reset;
      output += `${spinner} ${currentTask.name}`;
    } else {
      output += `${COLORS.gray}Initializing...${COLORS.reset}`;
    }
    
    // Clear to end of line
    output += '\x1b[K';
    
    process.stdout.write(output);
  }

  startSpinner() {
    this.spinnerInterval = setInterval(() => {
      this.currentFrame = (this.currentFrame + 1) % SPINNER_FRAMES.length;
      this.render();
    }, 100);
  }

  stopSpinner() {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
    }
  }

  finish(serverUrl: string, viteUrl?: string, hmrUrl?: string) {
    this.stopSpinner();
    
    // Clear the status line
    let output = `\x1b[${this.headerLines + 1};0H`;
    output += '\x1b[J'; // Clear from cursor down
    process.stdout.write(output);
    
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    
    this.originalConsoleLog('');
    this.originalConsoleLog(COLORS.green + COLORS.bold + '✨ Server ready!' + COLORS.reset);
    this.originalConsoleLog('');
    this.originalConsoleLog(COLORS.cyan + '  ➜  ' + COLORS.reset + COLORS.bold + 'Local:   ' + COLORS.reset + COLORS.cyan + serverUrl + COLORS.reset);
    
    if (viteUrl) {
      this.originalConsoleLog(COLORS.cyan + '  ➜  ' + COLORS.reset + COLORS.bold + 'Vite:    ' + COLORS.reset + COLORS.gray + viteUrl + COLORS.reset);
    }
    
    if (hmrUrl) {
      this.originalConsoleLog(COLORS.cyan + '  ➜  ' + COLORS.reset + COLORS.bold + 'HMR:     ' + COLORS.reset + COLORS.gray + hmrUrl + COLORS.reset);
    }
    
    this.originalConsoleLog('');
    this.originalConsoleLog(COLORS.gray + `  Ready in ${elapsed}s` + COLORS.reset);
    this.originalConsoleLog('');
    this.originalConsoleLog(COLORS.gray + '  Press Ctrl+C to stop' + COLORS.reset);
    this.originalConsoleLog('');
    
  }
}

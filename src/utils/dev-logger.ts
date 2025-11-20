/**
 * Dev Server Logger - Cool ASCII loader for Avalon dev server
 */

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
  private tasks: Map<string, DevTask> = new Map();
  private spinnerInterval?: number;
  private currentFrame = 0;
  private startTime = Date.now();
  private originalConsoleLog: typeof console.log;
  private originalConsoleWarn: typeof console.warn;
  private originalConsoleError: typeof console.error;
  private suppressedLogs: string[] = [];

  constructor() {
    // Capture original console methods
    this.originalConsoleLog = console.log;
    this.originalConsoleWarn = console.warn;
    this.originalConsoleError = console.error;
    
    // Suppress console output during startup
    this.suppressConsole();
    
    // Clear screen once at start
    const encoder = new TextEncoder();
    Deno.stdout.writeSync(encoder.encode('\x1b[2J\x1b[H'));
    
    // Print header once
    let header = COLORS.cyan + AVALON_ASCII + COLORS.reset + '\n';
    header += COLORS.gray + '  Development Server' + COLORS.reset + '\n\n';
    Deno.stdout.writeSync(encoder.encode(header));
  }

  private suppressConsole() {
    // Redirect console.log to capture but not display
    console.log = (...args: unknown[]) => {
      this.suppressedLogs.push(args.map(a => String(a)).join(' '));
    };
    console.warn = (...args: unknown[]) => {
      this.suppressedLogs.push('[WARN] ' + args.map(a => String(a)).join(' '));
    };
    // Keep errors visible
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

  async completeTask(id: string) {
    const task = this.tasks.get(id);
    if (task) {
      // Ensure minimum display time of 300ms for spinner visibility
      const elapsed = Date.now() - (task.startTime || 0);
      const minDisplayTime = 300;
      if (elapsed < minDisplayTime) {
        await new Promise(resolve => setTimeout(resolve, minDisplayTime - elapsed));
      }
      
      task.status = 'done';
      this.render();
    }
  }

  private getStatusIcon(status: DevTask['status']): string {
    switch (status) {
      case 'pending':
        return COLORS.gray + '○' + COLORS.reset;
      case 'running':
        return COLORS.cyan + SPINNER_FRAMES[this.currentFrame] + COLORS.reset;
      case 'done':
        return COLORS.green + '✓' + COLORS.reset;
    }
  }

  private render() {
    // Calculate line number where tasks start (after header)
    const headerLines = AVALON_ASCII.split('\n').length + 2; // ASCII + "Development Server" + blank line
    
    // Move to task list start and update tasks
    let output = `\x1b[${headerLines + 1};0H`; // Move to first task line
    
    // Add tasks
    for (const [_id, task] of this.tasks) {
      const icon = this.getStatusIcon(task.status);
      const line = `${icon} ${task.name}`;
      output += line + '\x1b[K\n'; // Clear to end of line and move to next
    }
    
    // Write directly to stdout
    const encoder = new TextEncoder();
    Deno.stdout.writeSync(encoder.encode(output));
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
    this.render();
    
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    
    // Use original console for final output
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
    
    // Keep console suppressed to maintain clean output during runtime
    // Console will be restored on shutdown
  }
}

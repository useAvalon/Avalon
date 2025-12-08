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
  private headerLines = 0;

  constructor() {
    this.originalConsoleLog = console.log;
    this.originalConsoleWarn = console.warn;
    this.originalConsoleError = console.error;
    
    this.suppressConsole();
    
    // Clear screen once at start
    const encoder = new TextEncoder();
    Deno.stdout.writeSync(encoder.encode('\x1b[2J\x1b[H'));
    
    const header = COLORS.cyan + AVALON_ASCII + COLORS.reset + '\n' +
                   COLORS.gray + '  Development Server' + COLORS.reset + '\n\n';
    this.headerLines = AVALON_ASCII.split('\n').length + 2;
    
    Deno.stdout.writeSync(encoder.encode(header));
  }

  private suppressConsole() {
    console.log = (...args: unknown[]) => {
      this.suppressedLogs.push(args.map(a => String(a)).join(' '));
    };
    console.warn = (...args: unknown[]) => {
      this.suppressedLogs.push('[WARN] ' + args.map(a => String(a)).join(' '));
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
    
    // Clear the status line
    const encoder = new TextEncoder();
    let output = `\x1b[${this.headerLines + 1};0H`;
    output += '\x1b[J'; // Clear from cursor down
    Deno.stdout.writeSync(encoder.encode(output));
    
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

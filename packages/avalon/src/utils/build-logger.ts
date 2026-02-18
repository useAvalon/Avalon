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

interface BuildTask {
  name: string;
  status: 'pending' | 'running' | 'done' | 'error';
  progress?: number;
  total?: number;
}

export class BuildLogger {
  private tasks: Map<string, BuildTask> = new Map();
  private spinnerInterval?: number;
  private currentFrame = 0;
  private startTime = Date.now();
  private encoder = new TextEncoder();
  private originalConsoleLog: typeof console.log;
  private originalConsoleWarn: typeof console.warn;
  private isTTY = false;

  constructor() {
    // Capture and suppress console output
    this.originalConsoleLog = console.log;
    this.originalConsoleWarn = console.warn;
    console.log = () => {}; // Suppress
    console.warn = () => {}; // Suppress
    
    // Check if we're in a TTY
    this.isTTY = process.stdout.isTTY ?? false;
    
    if (this.isTTY) {
      // Clear screen once and hide cursor
      process.stdout.write('\x1b[2J\x1b[H\x1b[?25l');
      
      // Print ASCII art header (only once)
      const header = COLORS.cyan + AVALON_ASCII + COLORS.reset + '\n';
      process.stdout.write(header);
    } else {
      // Non-TTY: just print header once
      this.originalConsoleLog(COLORS.cyan + COLORS.bold + 'Avalon Build' + COLORS.reset);
      this.originalConsoleLog('');
    }
  }

  addTask(id: string, name: string) {
    this.tasks.set(id, { name, status: 'pending' });
    // Don't render yet - wait for spinner to start
  }

  startTask(id: string) {
    const task = this.tasks.get(id);
    if (task) {
      task.status = 'running';
      // Only render if spinner is running
      if (this.spinnerInterval) {
        this.render();
      }
    }
  }

  updateProgress(id: string, progress: number, total: number) {
    const task = this.tasks.get(id);
    if (task) {
      task.progress = progress;
      task.total = total;
      // Only render if spinner is running
      if (this.spinnerInterval) {
        this.render();
      }
    }
  }

  completeTask(id: string) {
    const task = this.tasks.get(id);
    if (task) {
      task.status = 'done';
      // Only render if spinner is running
      if (this.spinnerInterval) {
        this.render();
      }
    }
  }

  errorTask(id: string) {
    const task = this.tasks.get(id);
    if (task) {
      task.status = 'error';
      // Only render if spinner is running
      if (this.spinnerInterval) {
        this.render();
      }
    }
  }

  private render() {
    if (this.isTTY) {
      // Find the currently running task
      let currentTask: BuildTask | null = null;
      for (const task of this.tasks.values()) {
        if (task.status === 'running') {
          currentTask = task;
          break;
        }
      }
      
      // Move to line 3 and show single status line
      let output = '\x1b[3;0H';
      
      if (currentTask) {
        const spinner = COLORS.cyan + SPINNER_FRAMES[this.currentFrame] + COLORS.reset;
        output += `${spinner} ${currentTask.name}\x1b[K\n`;
      } else {
        output += `${COLORS.gray}Initializing...\x1b[K\n` + COLORS.reset;
      }
      
      // Clear remaining lines below
      output += '\x1b[J';
      
      // Write directly to stdout
      process.stdout.write(output);
    }
  }

  startSpinner() {
    // Initial render
    this.render();
    
    this.spinnerInterval = setInterval(() => {
      this.currentFrame = (this.currentFrame + 1) % SPINNER_FRAMES.length;
      this.render();
    }, 80);
  }

  stopSpinner() {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
    }
  }

  finish(success: boolean) {
    this.stopSpinner();
    this.render();
    
    // Restore console
    console.log = this.originalConsoleLog;
    console.warn = this.originalConsoleWarn;
    
    if (this.isTTY) {
      // Show cursor
      process.stdout.write('\x1b[?25h');
    }
    
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    console.log('');
    
    if (success) {
      console.log(COLORS.green + '✨ Build completed successfully!' + COLORS.reset);
      console.log(COLORS.gray + `Total time: ${elapsed}s` + COLORS.reset);
    } else {
      console.log(COLORS.yellow + '❌ Build failed' + COLORS.reset);
    }
    console.log('');
  }
}

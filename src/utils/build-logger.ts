/**
 * Build Logger - Cool ASCII loader for Avalon builds
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

  constructor() {
    this.clear();
    this.printHeader();
  }

  private clear() {
    console.clear();
  }

  private printHeader() {
    console.log(COLORS.cyan + AVALON_ASCII + COLORS.reset);
    console.log('');
  }

  addTask(id: string, name: string) {
    this.tasks.set(id, { name, status: 'pending' });
    this.render();
  }

  startTask(id: string) {
    const task = this.tasks.get(id);
    if (task) {
      task.status = 'running';
      this.render();
    }
  }

  updateProgress(id: string, progress: number, total: number) {
    const task = this.tasks.get(id);
    if (task) {
      task.progress = progress;
      task.total = total;
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

  errorTask(id: string) {
    const task = this.tasks.get(id);
    if (task) {
      task.status = 'error';
      this.render();
    }
  }

  private getStatusIcon(status: BuildTask['status']): string {
    switch (status) {
      case 'pending':
        return COLORS.gray + '○' + COLORS.reset;
      case 'running':
        return COLORS.cyan + SPINNER_FRAMES[this.currentFrame] + COLORS.reset;
      case 'done':
        return COLORS.green + '✓' + COLORS.reset;
      case 'error':
        return COLORS.yellow + '✗' + COLORS.reset;
    }
  }

  private getProgressBar(progress: number, total: number, width = 30): string {
    const percentage = Math.floor((progress / total) * 100);
    const filled = Math.floor((progress / total) * width);
    const empty = width - filled;
    
    const bar = COLORS.cyan + '█'.repeat(filled) + COLORS.gray + '░'.repeat(empty) + COLORS.reset;
    const stats = COLORS.gray + `${progress}/${total} (${percentage}%)` + COLORS.reset;
    
    return `${bar} ${stats}`;
  }

  private render() {
    // Move cursor to start of task list (after header)
    const headerLines = AVALON_ASCII.split('\n').length + 1;
    console.log(`\x1b[${headerLines};0H`);
    
    let lineNum = 0;
    for (const [_id, task] of this.tasks) {
      const icon = this.getStatusIcon(task.status);
      let line = `${icon} ${task.name}`;
      
      if (task.status === 'running' && task.progress !== undefined && task.total !== undefined) {
        line += '\n  ' + this.getProgressBar(task.progress, task.total);
        lineNum++;
      }
      
      console.log(line + '\x1b[K'); // Clear to end of line
      lineNum++;
    }
    
    // Clear remaining lines
    for (let i = 0; i < 5; i++) {
      console.log('\x1b[K');
    }
    
    // Print elapsed time
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    console.log('');
    console.log(COLORS.gray + `Elapsed: ${elapsed}s` + COLORS.reset);
  }

  startSpinner() {
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

// ---------------------------------------------------------------------------
// CLI logging helpers — colored, structured output
// ---------------------------------------------------------------------------

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';
const RED = '\x1b[31m';
const WHITE = '\x1b[37m';
const BG_RED = '\x1b[41m';
const BG_GREEN = '\x1b[42m';
const BG_BLUE = '\x1b[44m';
const BG_MAGENTA = '\x1b[45m';
const BG_CYAN = '\x1b[46m';

const ICONS = {
  anvil: '⚒',
  check: '✔',
  cross: '✖',
  arrow: '→',
  dot: '●',
  plus: '+',
  minus: '−',
  refresh: '↻',
  eye: '👁',
  bolt: '⚡',
  gear: '⚙',
  file: '📄',
  watch: '👀',
  link: '🔗',
  key: '🔑',
  box: '📦',
} as const;

function badge(bg: string, label: string): string {
  return `${bg}${BOLD}${WHITE} ${label} ${RESET}`;
}

export const log = {
  /** PocketForge header */
  banner() {
    console.log(`\n${BOLD}${MAGENTA}  ⚒  PocketForge${RESET} ${DIM}v0.1.0${RESET}\n`);
  },

  /** Labeled info line */
  info(msg: string) {
    console.log(`  ${CYAN}${ICONS.dot}${RESET} ${msg}`);
  },

  /** Success line */
  success(msg: string) {
    console.log(`  ${GREEN}${ICONS.check}${RESET} ${msg}`);
  },

  /** Warning */
  warn(msg: string) {
    console.log(`  ${YELLOW}${ICONS.dot}${RESET} ${msg}`);
  },

  /** Error */
  error(msg: string) {
    console.log(`  ${RED}${ICONS.cross}${RESET} ${msg}`);
  },

  /** Step heading (e.g. "PUSH", "GENERATE") */
  step(label: string) {
    console.log(`\n  ${BOLD}${BLUE}${label}${RESET}`);
  },

  /** Dim detail line */
  dim(msg: string) {
    console.log(`    ${DIM}${msg}${RESET}`);
  },

  /** File path output */
  file(path: string) {
    console.log(`    ${DIM}${ICONS.arrow}${RESET} ${path}`);
  },

  /** Collection list — compact, multi-column */
  collections(names: string[], opts?: { prefix?: string; color?: string }) {
    const color = opts?.color ?? DIM;
    const prefix = opts?.prefix ?? '';
    const maxWidth = 70;
    let line = `    ${prefix}`;
    for (let i = 0; i < names.length; i++) {
      const sep = i < names.length - 1 ? `${DIM},${RESET} ` : '';
      const part = `${color}${names[i]}${RESET}${sep}`;
      // Rough length (without ANSI codes)
      const plainPart = names[i] + (i < names.length - 1 ? ', ' : '');
      const plainLine = line.replace(/\x1b\[[0-9;]*m/g, '');
      if (plainLine.length + plainPart.length > maxWidth && i > 0) {
        console.log(line);
        line = `    ${' '.repeat(prefix.replace(/\x1b\[[0-9;]*m/g, '').length)}${part}`;
      } else {
        line += part;
      }
    }
    if (line.trim()) console.log(line);
  },

  /** Separator line */
  separator() {
    console.log(`  ${DIM}${'─'.repeat(50)}${RESET}`);
  },

  /** Summary line with counts */
  summary(counts: { created?: number; updated?: number; deleted?: number }) {
    const parts: string[] = [];
    if (counts.created) parts.push(`${GREEN}+${counts.created} created${RESET}`);
    if (counts.updated) parts.push(`${CYAN}↻${counts.updated} updated${RESET}`);
    if (counts.deleted) parts.push(`${RED}−${counts.deleted} deleted${RESET}`);
    if (parts.length === 0) parts.push(`${DIM}no changes${RESET}`);
    console.log(`\n  ${parts.join(`${DIM}  │  ${RESET}`)}`);
  },

  /** Timer helper */
  timer() {
    const start = Date.now();
    return {
      elapsed(): string {
        const ms = Date.now() - start;
        return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
      },
    };
  },

  /** Done message with timing */
  done(msg: string, elapsed?: string) {
    const time = elapsed ? ` ${DIM}(${elapsed})${RESET}` : '';
    console.log(`\n  ${GREEN}${ICONS.check}${RESET} ${BOLD}${msg}${RESET}${time}\n`);
  },

  /** Blank line */
  blank() {
    console.log();
  },
};

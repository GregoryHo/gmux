const ENTER = "\x1b[?1049h";
const EXIT = "\x1b[?1049l";

export function enterAlternateScreen(): void {
  process.stdout.write(ENTER);
}

export function exitAlternateScreen(): void {
  process.stdout.write(EXIT);
}

import { runTmux } from "./tmux.js";

export function buildSendKeysArgs(target: string, text: string): string[] {
  return ["send-keys", "-t", target, text, "Enter"];
}

export async function sendKeys(target: string, text: string): Promise<void> {
  await runTmux(buildSendKeysArgs(target, text));
}

export function buildInterruptArgs(target: string): string[] {
  return ["send-keys", "-t", target, "C-c"];
}

export async function interruptPane(target: string): Promise<void> {
  await runTmux(buildInterruptArgs(target));
}

export function buildKillSessionArgs(sessionName: string): string[] {
  return ["kill-session", "-t", sessionName];
}

export async function killSession(sessionName: string): Promise<void> {
  await runTmux(buildKillSessionArgs(sessionName));
}

export interface TmuxClient {
  name: string;
  tty: string;
}

export function buildListClientsArgs(): string[] {
  return ["list-clients", "-F", "#{client_name}|#{client_tty}"];
}

export async function listClients(): Promise<TmuxClient[]> {
  const stdout = await runTmux(buildListClientsArgs());
  return parseClientList(stdout);
}

export function parseClientList(stdout: string): TmuxClient[] {
  const clients: TmuxClient[] = [];
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    const parts = trimmed.split("|");
    if (parts.length !== 2) continue;
    clients.push({ name: parts[0], tty: parts[1] });
  }
  return clients;
}

export function buildSwitchClientArgs(clientName: string, sessionTarget: string): string[] {
  return ["switch-client", "-c", clientName, "-t", sessionTarget];
}

export async function switchClient(clientName: string, sessionTarget: string): Promise<void> {
  await runTmux(buildSwitchClientArgs(clientName, sessionTarget));
}

export function buildNewSessionArgs(name: string, dir: string): string[] {
  return ["new-session", "-d", "-s", name, "-c", dir];
}

export async function newSession(name: string, dir: string): Promise<void> {
  await runTmux(buildNewSessionArgs(name, dir));
}

export function buildSendLaunchCommandArgs(name: string, cmd: string): string[] {
  return ["send-keys", "-t", name, cmd, "Enter"];
}

export async function sendLaunchCommand(name: string, cmd: string): Promise<void> {
  await runTmux(buildSendLaunchCommandArgs(name, cmd));
}

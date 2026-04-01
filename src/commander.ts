import { execFile } from "node:child_process";
import { findTmuxBinary } from "./tmux.js";

/**
 * Execute a tmux command via execFile and return stdout.
 * All tmux interaction from the dashboard should go through this module.
 */
function runTmuxCommand(args: string[]): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const bin = await findTmuxBinary();
    execFile(bin, args, { timeout: 5000 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`tmux ${args[0]} failed: ${stderr || err.message}`));
        return;
      }
      resolve(stdout);
    });
  });
}

/**
 * Build the args array for tmux send-keys to a target pane.
 */
export function buildSendKeysArgs(target: string, text: string): string[] {
  return ["send-keys", "-t", target, text, "Enter"];
}

/**
 * Send text input to a tmux pane (simulates typing + Enter).
 */
export async function sendKeys(target: string, text: string): Promise<void> {
  await runTmuxCommand(buildSendKeysArgs(target, text));
}

/**
 * Build the args array for sending an interrupt (Ctrl-C) to a pane.
 */
export function buildInterruptArgs(target: string): string[] {
  return ["send-keys", "-t", target, "C-c"];
}

/**
 * Send Ctrl-C to a target pane to interrupt the running process.
 */
export async function interruptPane(target: string): Promise<void> {
  await runTmuxCommand(buildInterruptArgs(target));
}

/**
 * Build the args array for killing a tmux session.
 */
export function buildKillSessionArgs(sessionName: string): string[] {
  return ["kill-session", "-t", sessionName];
}

/**
 * Kill a tmux session by name.
 */
export async function killSession(sessionName: string): Promise<void> {
  await runTmuxCommand(buildKillSessionArgs(sessionName));
}

/** Parsed tmux client info. */
export interface TmuxClient {
  name: string;
  tty: string;
}

/**
 * Build the args array for listing tmux clients.
 */
export function buildListClientsArgs(): string[] {
  return ["list-clients", "-F", "#{client_name}|#{client_tty}"];
}

/**
 * List all tmux clients.
 */
export async function listClients(): Promise<TmuxClient[]> {
  const stdout = await runTmuxCommand(buildListClientsArgs());
  return parseClientList(stdout);
}

/**
 * Parse tmux list-clients output into TmuxClient array.
 */
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

/**
 * Build the args array for switching a client to a session.
 */
export function buildSwitchClientArgs(clientName: string, sessionTarget: string): string[] {
  return ["switch-client", "-c", clientName, "-t", sessionTarget];
}

/**
 * Switch a tmux client to focus on a specific session.
 */
export async function switchClient(clientName: string, sessionTarget: string): Promise<void> {
  await runTmuxCommand(buildSwitchClientArgs(clientName, sessionTarget));
}

/**
 * Build the args array for creating a new detached tmux session.
 */
export function buildNewSessionArgs(name: string, dir: string): string[] {
  return ["new-session", "-d", "-s", name, "-c", dir];
}

/**
 * Create a new detached tmux session with the given name and working directory.
 */
export async function newSession(name: string, dir: string): Promise<void> {
  await runTmuxCommand(buildNewSessionArgs(name, dir));
}

/**
 * Build the args array for sending a launch command to a session.
 */
export function buildSendLaunchCommandArgs(name: string, cmd: string): string[] {
  return ["send-keys", "-t", name, cmd, "Enter"];
}

/**
 * Send a launch command to a tmux session (types the command and presses Enter).
 */
export async function sendLaunchCommand(name: string, cmd: string): Promise<void> {
  await runTmuxCommand(buildSendLaunchCommandArgs(name, cmd));
}

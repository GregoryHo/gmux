import { useState, useEffect, useRef, useCallback } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";
import type { Server } from "node:net";
import type { GmuxConfig } from "./config.js";
import type { AgentSession } from "./types.js";
import type { AgentStatus } from "./types.js";
import type { SocketEvent } from "./socket-types.js";
import { TmuxPoller } from "./poller.js";
import { setupSocketServer } from "./socket-server.js";
import { validateEvent } from "./socket-events.js";
import { StatusOverrideStore } from "./status-overrides.js";
import { interruptPane, killSession, listClients, switchClient, newSession, sendLaunchCommand } from "./commander.js";
import type { TmuxClient } from "./commander.js";
import { Notifier } from "./notifier.js";
import {
  SessionList,
  DetailPanel,
  NotificationFeed,
  CommandInput,
  ClientPicker,
  SessionCreator,
  createNotification,
  addNotification,
} from "./components/index.js";
import type { NotificationEvent } from "./components/index.js";

export interface AppProps {
  config: GmuxConfig;
  server: Server | null;
}

/** UI mode for overlays. */
type UIMode =
  | { kind: "normal" }
  | { kind: "confirm-kill"; sessionName: string }
  | { kind: "client-picker"; clients: TmuxClient[] }
  | { kind: "create-session" }
  | { kind: "flash"; message: string };

export function App({ config, server }: AppProps) {
  const { exit } = useApp();
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [uiMode, setUIMode] = useState<UIMode>({ kind: "normal" });
  const [degraded, setDegraded] = useState(false);
  const pollerRef = useRef<TmuxPoller | null>(null);
  const overridesRef = useRef(new StatusOverrideStore());
  const prevStatusRef = useRef(new Map<string, AgentStatus>());
  const notifierRef = useRef(new Notifier(config));

  // Auto-clear flash messages after 2 seconds
  useEffect(() => {
    if (uiMode.kind !== "flash") return;
    const timer = setTimeout(() => setUIMode({ kind: "normal" }), 2000);
    return () => clearTimeout(timer);
  }, [uiMode]);

  // Socket server setup (skip when server is null — socket unavailable mode)
  useEffect(() => {
    if (!server) return;
    setupSocketServer(server, (raw: SocketEvent) => {
      const event = validateEvent(raw);
      if (!event) return;

      const target = `${event.session}:${event.pane}`;

      if (event.event === "status" && event.status) {
        overridesRef.current.set(target, event.status as AgentStatus);
      }

      if (event.event === "notify" && event.message) {
        setNotifications((prev) =>
          addNotification(
            prev,
            createNotification(event.session, event.message!),
          ),
        );
      }
    });
  }, [server]);

  // Poller setup
  useEffect(() => {
    const poller = new TmuxPoller(config.pollInterval, overridesRef.current);
    pollerRef.current = poller;

    poller.on("add", (session: AgentSession) => {
      setNotifications((prev) =>
        addNotification(
          prev,
          createNotification(session.sessionName, "session started"),
        ),
      );
    });

    poller.on("remove", (target: string) => {
      // Extract session name from target "session:window.pane"
      const colonIdx = target.indexOf(":");
      const name = colonIdx > 0 ? target.substring(0, colonIdx) : target;
      setNotifications((prev) =>
        addNotification(prev, createNotification(name, "session ended")),
      );
      notifierRef.current.notify(name, "session ended");
    });

    poller.on("update", (updated: AgentSession[]) => {
      // Detect status changes to idle/needs_attention
      const prevMap = prevStatusRef.current;
      for (const session of updated) {
        const prev = prevMap.get(session.target);
        if (
          prev &&
          prev !== session.status &&
          (session.status === "idle" || session.status === "needs_attention")
        ) {
          const msg =
            session.status === "idle" ? "finished" : "needs input";
          setNotifications((events) =>
            addNotification(
              events,
              createNotification(session.sessionName, msg),
            ),
          );
          notifierRef.current.notify(session.sessionName, msg);
        }
      }

      // Update prev status map
      const newMap = new Map<string, AgentStatus>();
      for (const s of updated) {
        newMap.set(s.target, s.status);
      }
      prevStatusRef.current = newMap;

      setSessions(updated);

      // On successful update, check if degraded state recovered
      setDegraded(poller.degraded);
    });

    poller.on("error", (err: Error) => {
      console.error(`gmux: poll error: ${err.message}`);
      setDegraded(poller.degraded);
    });

    poller.start();

    return () => {
      poller.stop();
      pollerRef.current = null;
    };
  }, [config.pollInterval]);

  // Keep selectedIndex in bounds
  useEffect(() => {
    if (sessions.length === 0) {
      setSelectedIndex(0);
    } else if (selectedIndex >= sessions.length) {
      setSelectedIndex(sessions.length - 1);
    }
  }, [sessions.length, selectedIndex]);

  const selectedSession =
    sessions.length > 0 ? sessions[selectedIndex] ?? null : null;

  const handleFocusSession = useCallback(async () => {
    if (!selectedSession) return;

    try {
      const clients = await listClients();
      // Exclude gmux's own client by matching our TTY
      const ownTty = process.env["TTY"] ?? "";
      const otherClients = clients.filter((c) => c.tty !== ownTty);

      if (otherClients.length === 0) {
        setUIMode({ kind: "flash", message: "No tmux clients available" });
      } else if (otherClients.length === 1) {
        await switchClient(
          otherClients[0].name,
          selectedSession.sessionName,
        );
        setUIMode({
          kind: "flash",
          message: `Focused ${selectedSession.sessionName}`,
        });
      } else {
        setUIMode({ kind: "client-picker", clients: otherClients });
      }
    } catch {
      setUIMode({ kind: "flash", message: "Failed to list clients" });
    }
  }, [selectedSession]);

  const handleCreateSession = useCallback(
    async (dir: string, name: string, cmd: string) => {
      // Expand ~ to home directory
      const expandedDir = dir.startsWith("~")
        ? resolve(homedir(), dir.slice(1).replace(/^\//, ""))
        : resolve(dir);

      // Validate directory exists
      try {
        const st = await stat(expandedDir);
        if (!st.isDirectory()) {
          setUIMode({ kind: "flash", message: `Not a directory: ${dir}` });
          return;
        }
      } catch {
        setUIMode({ kind: "flash", message: `Directory not found: ${dir}` });
        return;
      }

      // Create session
      try {
        await newSession(name, expandedDir);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("duplicate") || msg.includes("already")) {
          setUIMode({
            kind: "flash",
            message: `Session '${name}' already exists`,
          });
        } else {
          setUIMode({
            kind: "flash",
            message: `Failed to create session: ${msg}`,
          });
        }
        return;
      }

      // Send launch command
      try {
        await sendLaunchCommand(name, cmd);
      } catch {
        // Session was created but command failed — still show success
      }

      setUIMode({ kind: "flash", message: `Created session ${name}` });
      setNotifications((prev) =>
        addNotification(prev, createNotification(name, "session created")),
      );
    },
    [],
  );

  // Handle sendKeys failure: remove pane from sessions, add notification
  const handleSendError = useCallback((target: string, error: Error) => {
    const msg = error.message || "";
    // Check if the error indicates the pane/session is gone
    if (msg.includes("can't find") || msg.includes("no such") || msg.includes("not found") || msg.includes("failed")) {
      // Remove the pane from the session list immediately
      setSessions((prev) => prev.filter((s) => s.target !== target));

      // Extract session name from target
      const colonIdx = target.indexOf(":");
      const name = colonIdx > 0 ? target.substring(0, colonIdx) : target;
      setNotifications((prev) =>
        addNotification(prev, createNotification(name, "session ended")),
      );
    }
  }, []);

  // Main keybindings
  useInput(
    (input, key) => {
      // Quit
      if (input === "q" || (key.ctrl && input === "q")) {
        exit();
        return;
      }

      // Navigate sessions
      if (key.upArrow || input === "k") {
        setSelectedIndex((prev) =>
          sessions.length === 0
            ? 0
            : (prev - 1 + sessions.length) % sessions.length,
        );
        return;
      }
      if (key.downArrow || input === "j") {
        setSelectedIndex((prev) =>
          sessions.length === 0 ? 0 : (prev + 1) % sessions.length,
        );
        return;
      }

      // Ctrl-C: interrupt selected pane
      if (key.ctrl && input === "c") {
        if (selectedSession) {
          void interruptPane(selectedSession.target);
        }
        return;
      }

      // Ctrl-K: kill session (show confirmation)
      if (key.ctrl && input === "k") {
        if (selectedSession) {
          setUIMode({
            kind: "confirm-kill",
            sessionName: selectedSession.sessionName,
          });
        }
        return;
      }

      // Ctrl-N: create session wizard
      if (key.ctrl && input === "n") {
        setUIMode({ kind: "create-session" });
        return;
      }

      // Ctrl-F: focus selected session
      if (key.ctrl && input === "f") {
        void handleFocusSession();
        return;
      }
    },
    { isActive: uiMode.kind === "normal" || uiMode.kind === "flash" },
  );

  // Confirm-kill keybindings
  useInput(
    (input, key) => {
      if (uiMode.kind !== "confirm-kill") return;
      if (input === "y" || input === "Y") {
        void killSession(uiMode.sessionName);
        setNotifications((prev) =>
          addNotification(
            prev,
            createNotification(uiMode.sessionName, "killed"),
          ),
        );
        setUIMode({ kind: "normal" });
        return;
      }
      if (input === "n" || input === "N" || key.escape) {
        setUIMode({ kind: "normal" });
        return;
      }
    },
    { isActive: uiMode.kind === "confirm-kill" },
  );

  const count = sessions.length;
  const activeCount = sessions.filter((s) => s.status === "active").length;
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <Box flexDirection="column">
      {/* Degraded mode banner */}
      {degraded ? (
        <Box paddingX={1}>
          <Text color="yellow" bold>
            {"⚠ tmux not reachable — retrying every 5s"}
          </Text>
        </Box>
      ) : null}

      {/* Socket unavailable banner */}
      {server === null ? (
        <Box paddingX={1}>
          <Text color="yellow" bold>
            {"⚠ socket unavailable — polling only"}
          </Text>
        </Box>
      ) : null}

      {/* Header */}
      <Box borderStyle="single" paddingX={1} justifyContent="space-between">
        <Box gap={1}>
          <Text bold>gmux</Text>
          <Text>
            — {count} session{count !== 1 ? "s" : ""}
            {activeCount > 0 ? ` · ${activeCount} active` : ""}
          </Text>
        </Box>
        <Text dimColor>{timeStr}</Text>
      </Box>

      {/* Session List */}
      <Box borderStyle="single" flexDirection="column">
        <SessionList
          sessions={sessions}
          selectedIndex={selectedIndex}
          dimmed={degraded}
        />
      </Box>

      {/* Detail Panel + Notifications */}
      <Box borderStyle="single" flexDirection="column">
        <DetailPanel session={selectedSession} />
        {notifications.length > 0 ? (
          <Box marginTop={0}>
            <NotificationFeed events={notifications} maxDisplay={5} />
          </Box>
        ) : null}
      </Box>

      {/* Overlays */}
      {uiMode.kind === "confirm-kill" ? (
        <Box paddingX={1}>
          <Text color="yellow">
            Kill session {uiMode.sessionName}? (y/n)
          </Text>
        </Box>
      ) : null}

      {uiMode.kind === "create-session" ? (
        <SessionCreator
          onCreate={(dir, name, cmd) => {
            void handleCreateSession(dir, name, cmd);
          }}
          onCancel={() => setUIMode({ kind: "normal" })}
        />
      ) : null}

      {uiMode.kind === "client-picker" ? (
        <ClientPicker
          clients={uiMode.clients}
          onSelect={async (client) => {
            if (selectedSession) {
              try {
                await switchClient(
                  client.name,
                  selectedSession.sessionName,
                );
                setUIMode({
                  kind: "flash",
                  message: `Focused ${selectedSession.sessionName}`,
                });
              } catch {
                setUIMode({ kind: "flash", message: "Switch failed" });
              }
            } else {
              setUIMode({ kind: "normal" });
            }
          }}
          onCancel={() => setUIMode({ kind: "normal" })}
        />
      ) : null}

      {uiMode.kind === "flash" ? (
        <Box paddingX={1}>
          <Text dimColor>{uiMode.message}</Text>
        </Box>
      ) : null}

      {/* Command Input */}
      <Box borderStyle="single">
        <CommandInput
          selectedTarget={selectedSession?.target ?? null}
          isActive={uiMode.kind === "normal"}
          onError={handleSendError}
        />
      </Box>
    </Box>
  );
}

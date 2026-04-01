import { useState, useEffect, useRef, useCallback } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";
import type { Server } from "node:net";
import type { GmuxConfig } from "./config.js";
import type { AgentSession, AgentStatus } from "./types.js";
import { sessionNameFromTarget } from "./utils.js";
import { TmuxPoller } from "./poller.js";
import { setupSocketServer } from "./socket-server.js";
import { validateEvent } from "./socket-events.js";
import { StatusOverrideStore } from "./status-overrides.js";
import { readConversation, type ConversationEntry } from "./jsonl-reader.js";
import { runTmux } from "./tmux.js";
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
  | { kind: "expanded-detail" }
  | { kind: "flash"; message: string };

export function App({ config, server }: AppProps) {
  const { exit } = useApp();
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [uiMode, setUIMode] = useState<UIMode>({ kind: "normal" });
  const [degraded, setDegraded] = useState(false);
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [scrollbackContent, setScrollbackContent] = useState("");
  const [scrollOffset, setScrollOffset] = useState(0);
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
    setupSocketServer(server, (raw: unknown) => {
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
      const name = sessionNameFromTarget(target);
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

      // Only update sessions if something actually changed
      setSessions((prev) => {
        if (prev.length !== updated.length) return updated;
        const changed = updated.some((s, i) =>
          s.target !== prev[i]?.target || s.status !== prev[i]?.status || s.paneContent !== prev[i]?.paneContent
        );
        return changed ? updated : prev;
      });

      if (poller.degraded !== degraded) setDegraded(poller.degraded);
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

  // Fetch JSONL conversation when selected session changes
  useEffect(() => {
    if (!selectedSession) {
      setConversation([]);
      return;
    }

    let cancelled = false;
    readConversation(selectedSession.cwd, 3).then((entries) => {
      if (!cancelled) setConversation(entries);
    });

    return () => { cancelled = true; };
  }, [selectedSession?.target]);

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

      const name = sessionNameFromTarget(target);
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

      // Ctrl-E: expand detail panel (scrollback relay)
      if (key.ctrl && input === "e") {
        if (selectedSession) {
          setScrollOffset(0);
          // Capture full scrollback on-demand
          runTmux(["capture-pane", "-t", selectedSession.target, "-p", "-S", "-"])
            .then((content) => {
              setScrollbackContent(content);
              setUIMode({ kind: "expanded-detail" });
            })
            .catch(() => {
              setUIMode({ kind: "flash", message: "Failed to capture scrollback" });
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

  // Expanded detail view keybindings
  useInput(
    (input, key) => {
      if (key.escape || (key.ctrl && input === "e")) {
        setUIMode({ kind: "normal" });
        return;
      }
      if (key.upArrow || input === "k") {
        setScrollOffset((prev) => Math.max(0, prev - 1));
        return;
      }
      if (key.downArrow || input === "j") {
        setScrollOffset((prev) => prev + 1);
        return;
      }
      if (key.ctrl && input === "u") {
        setScrollOffset((prev) => Math.max(0, prev - 10));
        return;
      }
      if (key.ctrl && input === "d") {
        setScrollOffset((prev) => prev + 10);
        return;
      }
    },
    { isActive: uiMode.kind === "expanded-detail" },
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

      {/* Session List — dimmed when expanded */}
      <Box borderStyle="single" flexDirection="column">
        <SessionList
          sessions={sessions}
          selectedIndex={selectedIndex}
          dimmed={degraded || uiMode.kind === "expanded-detail"}
        />
      </Box>

      {/* Detail Panel + Notifications */}
      <Box borderStyle="single" flexDirection="column">
        <DetailPanel
          session={selectedSession}
          conversation={conversation}
          expanded={uiMode.kind === "expanded-detail"}
          scrollbackContent={scrollbackContent}
          scrollOffset={scrollOffset}
        />
        {uiMode.kind !== "expanded-detail" && notifications.length > 0 ? (
          <NotificationFeed events={notifications} maxDisplay={5} />
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

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";
import type { Server } from "node:net";
import type { GmuxConfig } from "./config.js";
import type { AgentSession, AgentStatus } from "./types.js";
import { sessionNameFromTarget } from "./utils.js";
import { calculateZoneHeights, calculateFocusHeight } from "./layout.js";
import { TmuxPoller } from "./poller.js";
import { setupSocketServer } from "./socket-server.js";
import { validateEvent } from "./socket-events.js";
import { StatusOverrideStore } from "./status-overrides.js";
import { readConversation, type ConversationEntry } from "./jsonl-reader.js";
import { captureFullScrollback } from "./tmux.js";
import { interruptPane, killSession, listClients, switchClient, newSession, sendKeys } from "./commander.js";
import type { TmuxClient } from "./commander.js";
import { Notifier } from "./notifier.js";
import {
  SessionList,
  DetailPanel,
  NotificationFeed,
  CommandInput,
  ClientPicker,
  SessionCreator,
  Header,
  SearchInput,
  createNotification,
  addNotification,
} from "./components/index.js";
import type { NotificationEvent } from "./components/index.js";

export interface AppProps {
  config: GmuxConfig;
  server: Server | null;
}

type UIMode =
  | { kind: "normal" }
  | { kind: "confirm-kill"; sessionName: string }
  | { kind: "client-picker"; clients: TmuxClient[] }
  | { kind: "create-session" }
  | { kind: "expanded-detail" }
  | { kind: "flash"; message: string };

export function App({ config, server }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const rows = (stdout?.rows ?? 40) - 1;
  const cols = stdout?.columns ?? 80;
  const heights = useMemo(() => calculateZoneHeights(rows), [rows]);
  const focusHeight = useMemo(() => calculateFocusHeight(rows), [rows]);

  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [uiMode, setUIMode] = useState<UIMode>({ kind: "normal" });
  const [degraded, setDegraded] = useState(false);
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [scrollbackContent, setScrollbackContent] = useState("");
  const [scrollOffset, setScrollOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const pollerRef = useRef<TmuxPoller | null>(null);

  const pushNotification = useCallback((name: string, msg: string) => {
    setNotifications((prev) => addNotification(prev, createNotification(name, msg)));
  }, []);
  const overridesRef = useRef(new StatusOverrideStore());
  const prevStatusRef = useRef(new Map<string, AgentStatus>());
  const notifierRef = useRef(new Notifier(config));

  useEffect(() => {
    if (uiMode.kind !== "flash") return;
    const timer = setTimeout(() => setUIMode({ kind: "normal" }), 2000);
    return () => clearTimeout(timer);
  }, [uiMode]);

  useEffect(() => {
    if (!server) return;
    setupSocketServer(server, (raw: unknown) => {
      const event = validateEvent(raw);
      if (!event) return;

      const target = `${event.session}:${event.pane}`;

      const validStatuses: AgentStatus[] = ["active", "idle", "needs_attention"];
      if (event.event === "status" && event.status && validStatuses.includes(event.status as AgentStatus)) {
        overridesRef.current.set(target, event.status as AgentStatus);
      }

      if (event.event === "notify" && event.message) {
        pushNotification(event.session, event.message);
      }
    });
  }, [server]);

  useEffect(() => {
    const poller = new TmuxPoller(config.pollInterval, overridesRef.current);
    pollerRef.current = poller;

    poller.on("add", (session: AgentSession) => {
      pushNotification(session.sessionName, "session started");
    });

    poller.on("remove", (target: string) => {
      const name = sessionNameFromTarget(target);
      pushNotification(name, "session ended");
      notifierRef.current.notify(name, "session ended");
    });

    poller.on("update", (updated: AgentSession[]) => {
      const prevMap = prevStatusRef.current;
      for (const session of updated) {
        const prev = prevMap.get(session.target);
        if (
          prev &&
          prev !== session.status &&
          (session.status === "idle" || session.status === "needs_attention")
        ) {
          const msg = session.status === "idle" ? "finished" : "needs input";
          pushNotification(session.sessionName, msg);
          notifierRef.current.notify(session.sessionName, msg);
        }
      }

      const newMap = new Map<string, AgentStatus>();
      for (const s of updated) {
        newMap.set(s.target, s.status);
      }
      prevStatusRef.current = newMap;

      setSessions((prev) => {
        if (prev.length !== updated.length) return updated;
        const changed = updated.some((s, i) => {
          const p = prev[i];
          return !p || s.target !== p.target || s.status !== p.status
            || s.cwd !== p.cwd || s.metadata.contextPct !== p.metadata.contextPct;
        });
        return changed ? updated : prev;
      });

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

  useEffect(() => {
    if (sessions.length === 0) {
      setSelectedIndex(0);
    } else if (selectedIndex >= sessions.length) {
      setSelectedIndex(sessions.length - 1);
    }
  }, [sessions.length, selectedIndex]);

  useEffect(() => {
    if (searchQuery !== null) setSelectedIndex(0);
  }, [searchQuery]);

  const selectedSession =
    sessions.length > 0 ? sessions[selectedIndex] ?? null : null;

  useEffect(() => {
    if (!selectedSession) {
      setConversation([]);
      return;
    }

    const maxEntries = Math.max(3, heights.detail - 1);
    const fetchConversation = () => {
      readConversation(selectedSession.cwd, maxEntries).then(setConversation);
    };

    fetchConversation();
    const timer = setInterval(fetchConversation, config.pollInterval);

    return () => clearInterval(timer);
  }, [selectedSession?.target, config.pollInterval, heights.detail]);

  const handleFocusSession = useCallback(async () => {
    if (!selectedSession) return;

    try {
      const clients = await listClients();
      const ownTty = process.env["TTY"] ?? "";
      const otherClients = clients.filter((c) => c.tty !== ownTty);

      if (otherClients.length === 0) {
        setUIMode({ kind: "flash", message: "No tmux clients available" });
      } else if (otherClients.length === 1) {
        await switchClient(otherClients[0].name, selectedSession.sessionName);
        setUIMode({ kind: "flash", message: `Focused ${selectedSession.sessionName}` });
      } else {
        setUIMode({ kind: "client-picker", clients: otherClients });
      }
    } catch {
      setUIMode({ kind: "flash", message: "Failed to list clients" });
    }
  }, [selectedSession]);

  const handleCreateSession = useCallback(
    async (dir: string, name: string, cmd: string) => {
      const expandedDir = dir.startsWith("~")
        ? resolve(homedir(), dir.slice(1).replace(/^\//, ""))
        : resolve(dir);

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

      try {
        await newSession(name, expandedDir);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("duplicate") || msg.includes("already")) {
          setUIMode({ kind: "flash", message: `Session '${name}' already exists` });
        } else {
          setUIMode({ kind: "flash", message: `Failed to create session: ${msg}` });
        }
        return;
      }

      try {
        await sendKeys(name, cmd);
      } catch {
        // Session created but command failed
      }

      setUIMode({ kind: "flash", message: `Created session ${name}` });
      pushNotification(name, "session created");
    },
    [],
  );

  const handleSendError = useCallback((target: string, error: Error) => {
    const msg = error.message || "";
    if (msg.includes("can't find") || msg.includes("no such") || msg.includes("not found") || msg.includes("failed")) {
      setSessions((prev) => prev.filter((s) => s.target !== target));
      const name = sessionNameFromTarget(target);
      pushNotification(name, "session ended");
    }
  }, []);

  const isExpanded = uiMode.kind === "expanded-detail";
  const searchActive = searchQuery !== null;

  const selectPrev = () => setSelectedIndex((prev) =>
    sessions.length === 0 ? 0 : (prev - 1 + sessions.length) % sessions.length,
  );
  const selectNext = () => setSelectedIndex((prev) =>
    sessions.length === 0 ? 0 : (prev + 1) % sessions.length,
  );

  useInput(
    (_input, key) => {
      if (key.upArrow) { selectPrev(); return; }
      if (key.downArrow) { selectNext(); }
    },
    { isActive: !isExpanded && uiMode.kind !== "confirm-kill" },
  );

  useInput(
    (input, key) => {
      if (input === "q" || (key.ctrl && input === "q")) { exit(); return; }
      if (input === "/") { setSearchQuery(""); return; }
      if (input === "k") { selectPrev(); return; }
      if (input === "j") { selectNext(); return; }

      if (key.ctrl && input === "c") {
        if (selectedSession) void interruptPane(selectedSession.target);
        return;
      }

      if (key.ctrl && input === "k") {
        if (selectedSession) {
          setUIMode({ kind: "confirm-kill", sessionName: selectedSession.sessionName });
        }
        return;
      }

      if (key.ctrl && input === "e") {
        if (selectedSession) {
          setScrollOffset(0);
          captureFullScrollback(selectedSession.target)
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

      if (key.ctrl && input === "n") {
        setUIMode({ kind: "create-session" });
        return;
      }

      if (key.ctrl && input === "f") {
        void handleFocusSession();
        return;
      }
    },
    { isActive: (uiMode.kind === "normal" || uiMode.kind === "flash") && !searchActive },
  );

  useInput(
    (input, key) => {
      if (key.escape || (key.ctrl && input === "e")) {
        setScrollbackContent("");
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
      if (input === "q" || (key.ctrl && input === "q")) {
        exit();
        return;
      }
    },
    { isActive: isExpanded },
  );

  useInput(
    (input, key) => {
      if (uiMode.kind !== "confirm-kill") return;
      if (input === "y" || input === "Y") {
        void killSession(uiMode.sessionName);
        pushNotification(uiMode.sessionName, "killed");
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

  return (
    <Box flexDirection="column" height={rows}>
      <Header
        sessionCount={count}
        activeCount={activeCount}
        degraded={degraded}
        socketAvailable={server !== null}
        focusSession={isExpanded ? selectedSession?.target : undefined}
      />

      {!isExpanded ? (
        <Box borderStyle="single" flexDirection="column" height={heights.session + 2}>
          {searchActive ? (
            <SearchInput
              query={searchQuery}
              onChange={setSearchQuery}
              onCancel={() => setSearchQuery(null)}
            />
          ) : null}
          <SessionList
            sessions={sessions}
            selectedIndex={selectedIndex}
            dimmed={degraded}
            maxHeight={searchActive ? heights.session - 1 : heights.session}
            searchQuery={searchQuery ?? undefined}
          />
        </Box>
      ) : null}

      <Box borderStyle="single" flexDirection="column"
        height={isExpanded ? focusHeight : heights.detail + 2}>
        <DetailPanel
          session={selectedSession}
          conversation={conversation}
          expanded={isExpanded}
          scrollbackContent={scrollbackContent}
          scrollOffset={scrollOffset}
          visibleLines={isExpanded ? focusHeight - 2 : heights.detail}
          terminalWidth={cols}
        />
      </Box>

      {!isExpanded ? (
        <Box borderStyle="single" flexDirection="column" height={heights.notify + 2}>
          {notifications.length > 0 ? (
            <NotificationFeed events={notifications} maxHeight={heights.notify} />
          ) : (
            <Box paddingX={1}>
              <Text dimColor>No notifications</Text>
            </Box>
          )}
        </Box>
      ) : null}

      {uiMode.kind === "confirm-kill" ? (
        <Box paddingX={1}>
          <Text color="yellow">Kill session {uiMode.sessionName}? (y/n)</Text>
        </Box>
      ) : null}

      {uiMode.kind === "create-session" ? (
        <SessionCreator
          onCreate={(dir, name, cmd) => { void handleCreateSession(dir, name, cmd); }}
          onCancel={() => setUIMode({ kind: "normal" })}
        />
      ) : null}

      {uiMode.kind === "client-picker" ? (
        <ClientPicker
          clients={uiMode.clients}
          onSelect={async (client) => {
            if (selectedSession) {
              try {
                await switchClient(client.name, selectedSession.sessionName);
                setUIMode({ kind: "flash", message: `Focused ${selectedSession.sessionName}` });
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

      <CommandInput
        selectedTarget={selectedSession?.target ?? null}
        isActive={uiMode.kind === "normal" && !searchActive}
        onError={handleSendError}
      />
    </Box>
  );
}

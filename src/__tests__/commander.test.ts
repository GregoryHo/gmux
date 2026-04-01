import { describe, it, expect } from "vitest";
import {
  buildSendKeysArgs,
  buildInterruptArgs,
  buildKillSessionArgs,
  buildListClientsArgs,
  buildSwitchClientArgs,
  parseClientList,
} from "../commander.js";

describe("Commander", () => {
  describe("buildSendKeysArgs", () => {
    it("builds correct args for sending text", () => {
      const args = buildSendKeysArgs("app:0.0", "npm test");
      expect(args).toEqual(["send-keys", "-t", "app:0.0", "npm test", "Enter"]);
    });

    it("preserves the exact text without escaping", () => {
      const args = buildSendKeysArgs("work:1.0", "echo 'hello world'");
      expect(args).toEqual([
        "send-keys",
        "-t",
        "work:1.0",
        "echo 'hello world'",
        "Enter",
      ]);
    });
  });

  describe("buildInterruptArgs", () => {
    it("builds correct args for Ctrl-C", () => {
      const args = buildInterruptArgs("app:0.0");
      expect(args).toEqual(["send-keys", "-t", "app:0.0", "C-c"]);
    });
  });

  describe("buildKillSessionArgs", () => {
    it("builds correct args for killing a session", () => {
      const args = buildKillSessionArgs("myapp");
      expect(args).toEqual(["kill-session", "-t", "myapp"]);
    });
  });

  describe("buildListClientsArgs", () => {
    it("builds correct args for listing clients", () => {
      const args = buildListClientsArgs();
      expect(args).toEqual([
        "list-clients",
        "-F",
        "#{client_name}|#{client_tty}",
      ]);
    });
  });

  describe("buildSwitchClientArgs", () => {
    it("builds correct args for switching client to session", () => {
      const args = buildSwitchClientArgs("/dev/ttys001", "arcforge");
      expect(args).toEqual([
        "switch-client",
        "-c",
        "/dev/ttys001",
        "-t",
        "arcforge",
      ]);
    });
  });

  describe("parseClientList", () => {
    it("parses valid client list output", () => {
      const stdout =
        "/dev/ttys001|/dev/ttys001\n/dev/ttys002|/dev/ttys002\n";
      const clients = parseClientList(stdout);
      expect(clients).toEqual([
        { name: "/dev/ttys001", tty: "/dev/ttys001" },
        { name: "/dev/ttys002", tty: "/dev/ttys002" },
      ]);
    });

    it("handles empty output", () => {
      expect(parseClientList("")).toEqual([]);
      expect(parseClientList("\n")).toEqual([]);
    });

    it("skips malformed lines", () => {
      const stdout = "valid|/dev/ttys001\nbadline\nalso|valid|extra\n";
      const clients = parseClientList(stdout);
      expect(clients).toEqual([
        { name: "valid", tty: "/dev/ttys001" },
      ]);
    });
  });
});

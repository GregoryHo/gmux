import { describe, it, expect } from "vitest";
import {
  buildNewSessionArgs,
  buildSendLaunchCommandArgs,
  buildKillSessionArgs,
} from "../commander.js";

describe("Session Management — commander", () => {
  describe("buildNewSessionArgs", () => {
    it("builds correct args for creating a detached session", () => {
      const args = buildNewSessionArgs("myproject", "/home/user/myproject");
      expect(args).toEqual([
        "new-session",
        "-d",
        "-s",
        "myproject",
        "-c",
        "/home/user/myproject",
      ]);
    });

    it("handles session names with hyphens", () => {
      const args = buildNewSessionArgs("my-app", "/tmp/my-app");
      expect(args).toEqual([
        "new-session",
        "-d",
        "-s",
        "my-app",
        "-c",
        "/tmp/my-app",
      ]);
    });

    it("handles paths with spaces", () => {
      const args = buildNewSessionArgs("proj", "/home/user/my project");
      expect(args).toEqual([
        "new-session",
        "-d",
        "-s",
        "proj",
        "-c",
        "/home/user/my project",
      ]);
    });
  });

  describe("buildSendLaunchCommandArgs", () => {
    it("builds correct args for sending a launch command", () => {
      const args = buildSendLaunchCommandArgs("myproject", "claude -c");
      expect(args).toEqual([
        "send-keys",
        "-t",
        "myproject",
        "claude -c",
        "Enter",
      ]);
    });

    it("handles custom commands", () => {
      const args = buildSendLaunchCommandArgs("dev", "npm run dev");
      expect(args).toEqual([
        "send-keys",
        "-t",
        "dev",
        "npm run dev",
        "Enter",
      ]);
    });

    it("preserves command text without modification", () => {
      const args = buildSendLaunchCommandArgs("app", "echo 'hello world'");
      expect(args).toEqual([
        "send-keys",
        "-t",
        "app",
        "echo 'hello world'",
        "Enter",
      ]);
    });
  });

  describe("buildKillSessionArgs (session-kill verification)", () => {
    it("builds correct args for killing a session", () => {
      const args = buildKillSessionArgs("myapp");
      expect(args).toEqual(["kill-session", "-t", "myapp"]);
    });

    it("handles session names with special characters", () => {
      const args = buildKillSessionArgs("my-app_v2");
      expect(args).toEqual(["kill-session", "-t", "my-app_v2"]);
    });
  });
});

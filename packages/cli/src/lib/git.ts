import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export interface GitRemote {
  name: string;
  url: string;
  type: "github" | "gitlab" | "other";
}

export interface GitInfo {
  isGitRepo: boolean;
  remotes: GitRemote[];
  currentBranch: string;
  rootDir: string;
}

export class GitDetector {
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  async detect(): Promise<GitInfo> {
    try {
      const isGitRepo = this.isGitRepository();
      if (!isGitRepo) {
        return {
          isGitRepo: false,
          remotes: [],
          currentBranch: "",
          rootDir: this.cwd,
        };
      }

      const rootDir = this.getRootDir();
      const remotes = this.getRemotes();
      const currentBranch = this.getCurrentBranch();

      return {
        isGitRepo: true,
        remotes,
        currentBranch,
        rootDir,
      };
    } catch {
      return {
        isGitRepo: false,
        remotes: [],
        currentBranch: "",
        rootDir: this.cwd,
      };
    }
  }

  private isGitRepository(): boolean {
    try {
      execSync("git rev-parse --git-dir", {
        cwd: this.cwd,
        stdio: "ignore",
      });
      return true;
    } catch {
      return false;
    }
  }

  private getRootDir(): string {
    try {
      const root = execSync("git rev-parse --show-toplevel", {
        cwd: this.cwd,
        encoding: "utf-8",
      }).trim();
      return root;
    } catch {
      return this.cwd;
    }
  }

  private getCurrentBranch(): string {
    try {
      const branch = execSync("git branch --show-current", {
        cwd: this.cwd,
        encoding: "utf-8",
      }).trim();
      return branch;
    } catch {
      return "";
    }
  }

  private getRemotes(): GitRemote[] {
    try {
      const output = execSync("git remote -v", {
        cwd: this.cwd,
        encoding: "utf-8",
      });

      const remotes: GitRemote[] = [];
      const lines = output.trim().split("\n");

      for (const line of lines) {
        const match = line.match(/^(\S+)\s+(\S+)\s+\((\w+)\)$/);
        if (match) {
          const [, name, url] = match;
          const type = this.detectRemoteType(url);
          if (!remotes.find((r) => r.name === name)) {
            remotes.push({ name, url, type });
          }
        }
      }

      return remotes;
    } catch {
      return [];
    }
  }

  private detectRemoteType(url: string): "github" | "gitlab" | "other" {
    if (url.includes("github.com")) return "github";
    if (url.includes("gitlab.com")) return "gitlab";
    return "other";
  }

  async getBranches(): Promise<string[]> {
    try {
      const output = execSync("git branch -a", {
        cwd: this.cwd,
        encoding: "utf-8",
      });

      return output
        .trim()
        .split("\n")
        .map((b) => b.replace(/^\*?\s*/, "").trim())
        .filter(
          (b) =>
            (b && !b.startsWith("remotes/")) || b.startsWith("remotes/origin/"),
        )
        .map((b) => b.replace(/^remotes\/origin\//, ""));
    } catch {
      return [];
    }
  }

  async getRepoId(): Promise<number | null> {
    try {
      const output = execSync("git remote get-url origin", {
        cwd: this.cwd,
        encoding: "utf-8",
      }).trim();

      const match = output.match(/git@github\.com:(\d+)\//);
      if (match) {
        return parseInt(match[1], 10);
      }

      const urlMatch = output.match(/github\.com\/[^\/]+\/([^\/\.]+)/);
      if (urlMatch) {
        return null;
      }

      return null;
    } catch {
      return null;
    }
  }

  static getProjectNameFromRepo(repoUrl: string): string {
    const match = repoUrl.match(/\/([^\/]+?)(?:\.git)?$/);
    return match ? match[1] : "";
  }

  static getOwnerFromRepo(repoUrl: string): string {
    const match = repoUrl.match(/github\.com\/([^\/]+)\//);
    return match ? match[1] : "";
  }
}

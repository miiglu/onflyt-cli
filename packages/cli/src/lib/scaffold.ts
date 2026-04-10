import { execSync } from "child_process";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  cpSync,
  rmSync,
} from "fs";
import { join } from "path";
import { createHash } from "crypto";

export interface ScaffoldProgress {
  stage: "cloning" | "installing" | "cleaning" | "done";
  message: string;
  progress?: number;
}

export class Scaffold {
  private cwd: string;
  private onProgress?: (progress: ScaffoldProgress) => void;
  private tempDir: string;

  constructor(cwd: string, onProgress?: (p: ScaffoldProgress) => void) {
    this.cwd = cwd;
    this.onProgress = onProgress;
    this.tempDir = join("/tmp", `onflyt-scaffold-${Date.now()}`);
  }

  report(progress: ScaffoldProgress) {
    if (this.onProgress) {
      this.onProgress(progress);
    }
  }

  async cloneTemplate(repoUrl: string, branch: string = "main"): Promise<void> {
    this.report({
      stage: "cloning",
      message: "Cloning template...",
      progress: 0,
    });

    try {
      mkdirSync(this.tempDir, { recursive: true });

      const gitUrl = repoUrl.endsWith(".git") ? repoUrl : `${repoUrl}.git`;

      execSync(
        `git clone --depth 1 --branch ${branch} ${gitUrl} "${this.tempDir}"`,
        { stdio: "pipe" },
      );

      this.report({
        stage: "cloning",
        message: "Template cloned",
        progress: 100,
      });
    } catch (error: any) {
      this.cleanup();
      throw new Error(`Failed to clone template: ${error.message}`);
    }
  }

  async installDependencies(packageManager: string): Promise<void> {
    if (!packageManager || packageManager === "none") {
      return;
    }

    this.report({
      stage: "installing",
      message: `Installing dependencies with ${packageManager}...`,
      progress: 0,
    });

    try {
      let installCmd = "";
      switch (packageManager) {
        case "npm":
          installCmd = "npm install";
          break;
        case "yarn":
          installCmd = "yarn install";
          break;
        case "pnpm":
          installCmd = "pnpm install";
          break;
        case "pip":
          installCmd = "pip install -r requirements.txt";
          break;
        case "poetry":
          installCmd = "poetry install";
          break;
        default:
          return;
      }

      execSync(installCmd, {
        cwd: this.tempDir,
        stdio: "inherit",
      });

      this.report({
        stage: "installing",
        message: "Dependencies installed",
        progress: 100,
      });
    } catch (error: any) {
      console.error(
        `Warning: Failed to install dependencies: ${error.message}`,
      );
      console.error("You may need to run the install command manually.");
    }
  }

  async moveFilesToProject(): Promise<void> {
    this.report({
      stage: "cleaning",
      message: "Preparing project files...",
      progress: 50,
    });

    try {
      const items = [
        "package.json",
        "requirements.txt",
        "src",
        "app",
        "lib",
        "components",
        "pages",
        "routes",
        "api",
        "main.py",
        "index.js",
        "server.js",
        "app.js",
        "main.go",
        "Cargo.toml",
        "go.mod",
        "README.md",
        "next.config.js",
        "next.config.mjs",
        "vite.config.ts",
        "vite.config.js",
        "nuxt.config.ts",
        "pyproject.toml",
      ];

      for (const item of items) {
        const srcPath = join(this.tempDir, item);
        const destPath = join(this.cwd, item);
        if (existsSync(srcPath) && !existsSync(destPath)) {
          cpSync(srcPath, destPath, { recursive: true });
        }
      }

      this.report({ stage: "cleaning", message: "Files copied", progress: 90 });
    } catch (error: any) {
      console.error(`Warning: Failed to copy some files: ${error.message}`);
    }
  }

  cleanup() {
    try {
      if (existsSync(this.tempDir)) {
        rmSync(this.tempDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  async scaffold(repoUrl: string, packageManager: string): Promise<void> {
    try {
      await this.cloneTemplate(repoUrl);
      await this.installDependencies(packageManager);
      await this.moveFilesToProject();
      this.cleanup();
      this.report({
        stage: "done",
        message: "Project scaffolded",
        progress: 100,
      });
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }
}

export function isGitInstalled(): boolean {
  try {
    execSync("git --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function isNodeInstalled(): boolean {
  try {
    execSync("node --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function initGitRepo(cwd: string, remoteUrl?: string): void {
  try {
    execSync("git init", { cwd, stdio: "pipe" });

    if (remoteUrl) {
      execSync(`git remote add origin ${remoteUrl}`, { cwd, stdio: "pipe" });
    }
  } catch (error: any) {
    throw new Error(`Failed to init git: ${error.message}`);
  }
}

export function generateProjectId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

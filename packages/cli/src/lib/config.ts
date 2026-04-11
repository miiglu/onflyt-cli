import { homedir } from "os";
import { join } from "path";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";

const CONFIG_DIR = join(homedir(), ".onflyt");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const PROJECT_CONFIG_FILE = "onflyt.json";

export const API_URL = process.env.ONFLYT_API_URL || "__ONFLYT_API_URL__";

export interface Config {
  token?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
  };
  defaultTeam?: string;
  lastLogin?: string;
}

export function getConfig(): Config {
  try {
    if (existsSync(CONFIG_FILE)) {
      return JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
    }
  } catch {
    // Return empty config if file doesn't exist or is invalid
  }
  return {};
}

export function saveConfig(config: Config): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function clearConfig(): void {
  if (existsSync(CONFIG_FILE)) {
    const config = getConfig();
    saveConfig({});
  }
}

export function isLoggedIn(): boolean {
  const config = getConfig();
  return !!config.token;
}

export interface ProjectConfig {
  id?: string;
  name: string;
  teamId?: string;
  framework: string;
  buildCommand?: string;
  outputDirectory?: string;
  installCommand?: string;
  startCommand?: string;
  gitRepoUrl?: string;
  gitBranch?: string;
  gitRepoId?: number;
}

export function getProjectConfig(
  cwd: string = process.cwd(),
): ProjectConfig | null {
  try {
    const configPath = join(cwd, PROJECT_CONFIG_FILE);
    if (existsSync(configPath)) {
      return JSON.parse(readFileSync(configPath, "utf-8"));
    }
  } catch {
    // Return null if file doesn't exist or is invalid
  }
  return null;
}

export function saveProjectConfig(
  config: ProjectConfig,
  cwd: string = process.cwd(),
): void {
  const configPath = join(cwd, PROJECT_CONFIG_FILE);
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

export function hasProjectConfig(cwd: string = process.cwd()): boolean {
  const configPath = join(cwd, PROJECT_CONFIG_FILE);
  return existsSync(configPath);
}

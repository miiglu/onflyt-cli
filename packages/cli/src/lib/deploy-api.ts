import { api } from "./api.js";
import { getConfig, API_URL } from "./config.js";
import {
  readFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "fs";
import { join, relative, basename } from "path";
import { execSync } from "child_process";
import {
  CONTAINER_TIER_SPECS,
  TIER_HOURLY_PRICE,
  ContainerTier,
} from "../shared";
import { getLimitsBySpend, TeamLimits, getTierLabel } from "../shared";

export interface Team {
  teamId: string;
  role: string;
  team: {
    id: string;
    name: string;
    slug: string;
    plan: string;
  };
}

export interface Balance {
  balanceUSD: number;
  balanceFormatted: string;
}

export interface ProjectConfig {
  name: string;
  framework?: string;
  buildCommand?: string;
  outputDirectory?: string;
  installCommand?: string;
  startCommand?: string;
  gitRepoUrl?: string;
  gitBranch?: string;
}

export interface InstanceOption {
  id: ContainerTier;
  label: string;
  cpu: string;
  ram: string;
  disk: string;
  maxReplicas: number;
  hourly: string;
}

export const INSTANCE_OPTIONS: InstanceOption[] = [
  {
    id: "micro",
    label: "Micro",
    cpu: "0.25",
    ram: "1GB",
    disk: "4GB",
    maxReplicas: 1,
    hourly: "Free",
  },
  {
    id: "lite",
    label: "Lite",
    cpu: "0.25",
    ram: "1GB",
    disk: "4GB",
    maxReplicas: 2,
    hourly: formatPrice(TIER_HOURLY_PRICE.lite),
  },
  {
    id: "standard",
    label: "Standard",
    cpu: "0.5",
    ram: "4GB",
    disk: "8GB",
    maxReplicas: 4,
    hourly: formatPrice(TIER_HOURLY_PRICE.standard),
  },
  {
    id: "pro",
    label: "Pro",
    cpu: "1",
    ram: "6GB",
    disk: "12GB",
    maxReplicas: 4,
    hourly: formatPrice(TIER_HOURLY_PRICE.pro),
  },
  {
    id: "business",
    label: "Business",
    cpu: "2",
    ram: "8GB",
    disk: "16GB",
    maxReplicas: 10,
    hourly: formatPrice(TIER_HOURLY_PRICE.business),
  },
];

function formatPrice(price: number): string {
  if (price === 0) return "Free";
  return `$${price.toFixed(3)}/hr`;
}

import { FRAMEWORKS, FrameworkConfig } from "../shared";

export function isPodProject(framework?: string): boolean {
  if (!framework) return false;
  const config = FRAMEWORKS[framework.toLowerCase()];
  if (!config) return false;
  return config.deploymentType === "container";
}

export function getDeploymentType(framework?: string): "static" | "container" {
  if (!framework) return "static";
  const config = FRAMEWORKS[framework.toLowerCase()];
  if (!config) return "static";
  return config.deploymentType;
}

export function getProjectConfig(): ProjectConfig | null {
  try {
    const configData = JSON.parse(
      readFileSync(`${process.cwd()}/onflyt.json`, "utf-8"),
    );
    return configData;
  } catch {
    return null;
  }
}

export async function loadTeamsWithBalances(): Promise<{
  teams: Team[];
  balances: Record<string, Balance>;
}> {
  const config = getConfig();
  api.setToken(config.token!);

  const meData = await api.get<any>("/auth/me");
  const teams: Team[] = meData.teams || [];

  const balances: Record<string, Balance> = {};
  await Promise.all(
    teams.map(async (team: Team) => {
      try {
        const balanceData = await api.get<any>(
          `/billing/balance?teamId=${team.team.id}`,
        );
        balances[team.team.id] = balanceData.data || balanceData;
      } catch {
        balances[team.team.id] = {
          balanceUSD: 0,
          balanceFormatted: "$0.00",
        };
      }
    }),
  );

  return { teams, balances };
}

export async function getTeamDetails(teamId: string): Promise<{
  totalLifetimeSpend: number;
  balanceUSD: number;
}> {
  try {
    const teamData = await api.get<any>(`/teams/${teamId}`);
    const team = teamData.team || teamData;
    return {
      totalLifetimeSpend: team.totalLifetimeSpend || 0,
      balanceUSD: team.balanceUSD || 0,
    };
  } catch {
    return { totalLifetimeSpend: 0, balanceUSD: 0 };
  }
}

export function getTeamLimits(totalSpend: number): TeamLimits {
  return getLimitsBySpend(totalSpend);
}

export function getTeamPlanLabel(totalSpend: number): string {
  return getTierLabel(totalSpend);
}

export async function findOrCreateProject(
  teamId: string,
  projectName: string,
  framework?: string,
  gitUrl?: string,
  instanceSize?: ContainerTier,
  maxInstances?: number,
): Promise<{
  id: string;
  name: string;
  isNew: boolean;
  existingProject?: any;
}> {
  const projectsRes = await api.get<any>(`/projects/team/${teamId}`);
  const existingProjects = projectsRes.projects || [];
  const existing = existingProjects.find((p: any) => p.name === projectName);

  if (existing) {
    return {
      id: existing.id,
      name: existing.name,
      isNew: false,
      existingProject: existing,
    };
  }

  const createRes = await api.post<any>("/projects", {
    name: projectName,
    framework: framework || "static",
    teamId,
    gitRepoUrl: gitUrl || null,
    instanceSize,
    maxInstances,
  });

  const project = createRes.project || createRes;
  return { id: project.id, name: project.name, isNew: true };
}

export async function updateProjectSettings(
  projectId: string,
  instanceSize?: ContainerTier,
  maxInstances?: number,
): Promise<void> {
  const updates: Record<string, any> = {};
  if (instanceSize) updates.instanceSize = instanceSize;
  if (maxInstances) updates.maxInstances = maxInstances;

  if (Object.keys(updates).length > 0) {
    await api.patch(`/projects/${projectId}`, updates);
  }
}

export async function getProjectDetails(projectId: string): Promise<any> {
  const res = await api.get<any>(`/projects/${projectId}`);
  return res.project || res;
}

export async function startDeployment(
  projectId: string,
  branch?: string,
  instanceSize?: ContainerTier,
  replicas?: number,
  envVars?: Array<{ key: string; value: string }>,
  buildCommand?: string,
  installCommand?: string,
  outputDirectory?: string,
): Promise<string> {
  const deployRes = await api.post<any>(`/deployments/${projectId}/deploy`, {
    branch: branch || "main",
    instanceSize,
    replicas,
    envVars,
    buildCommand,
    installCommand,
    outputDirectory,
  });

  return deployRes.deploymentId;
}

export type DeploymentStatus =
  | "queued"
  | "building"
  | "provisioning"
  | "deployed"
  | "failed";

export interface DeploymentDetails {
  status: DeploymentStatus;
  url?: string;
  previewUrl?: string;
}

export async function getDeploymentStatus(
  deploymentId: string,
): Promise<DeploymentDetails> {
  const res = await api.get<any>(`/deployments/detail/${deploymentId}`);
  const rawStatus = (
    res.status ||
    res.deployment?.status ||
    "queued"
  ).toLowerCase();

  if (rawStatus === "queued" || rawStatus === "uploaded") {
    return { status: "queued" };
  }
  if (rawStatus === "building") {
    return { status: "building" };
  }
  if (rawStatus === "live" || rawStatus === "running") {
    return {
      status: "deployed",
      url: res.deployment?.url || res.deployment?.previewUrl,
    };
  }
  if (rawStatus === "failed") {
    return { status: "failed" };
  }

  return { status: "queued" };
}

export function streamLogs(
  deploymentId: string,
  onLog: (log: string) => void,
  onError: () => void,
): () => void {
  let cancelled = false;

  const startStream = async () => {
    try {
      const response = await fetch(
        `${API_URL}/deployments/${deploymentId}/logs/stream`,
        {
          headers: { Authorization: `Bearer ${getConfig().token}` },
        },
      );

      if (!response.body) {
        onError();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      const read = () => {
        if (cancelled) return;

        reader.read().then(({ done, value }) => {
          if (done || cancelled) return;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter((l) => l.startsWith("data:"));

          lines.forEach((l) => {
            const log = l.replace("data: ", "").trim();
            if (log) onLog(log);
          });

          read();
        });
      };

      read();
    } catch {
      if (!cancelled) onError();
    }
  };

  startStream();

  return () => {
    cancelled = true;
  };
}

export interface StoredLog {
  timestamp: number;
  level: "error" | "warn" | "info" | "debug";
  message: string;
  source?: "build" | "runtime";
  replicaIndex?: number;
}

export interface StoredLogsResult {
  logs: StoredLog[];
  total: number;
  hasMore: boolean;
}

export async function getStoredLogs(
  deploymentId: string,
  options?: {
    source?: "build" | "runtime";
    replicaIndex?: number;
    limit?: number;
    offset?: number;
    search?: string;
  },
): Promise<StoredLogsResult> {
  const params = new URLSearchParams();
  if (options?.source) params.set("source", options.source);
  if (options?.replicaIndex !== undefined)
    params.set("replicaIndex", String(options.replicaIndex));
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.offset) params.set("offset", String(options.offset));
  if (options?.search) params.set("search", options.search);

  const queryString = params.toString();
  const endpoint = `/logs/deployments/${deploymentId}/logs${queryString ? `?${queryString}` : ""}`;

  const res = await api.get<any>(endpoint);
  return {
    logs: res.logs || [],
    total: res.total || 0,
    hasMore: res.hasMore || false,
  };
}

const DEFAULT_EXCLUDE_PATTERNS = [
  "node_modules",
  ".git",
  ".gitignore",
  ".env",
  ".env.local",
  ".env.*.local",
  "dist",
  "build",
  ".next",
  ".output",
  ".svelte-kit",
  ".turbo",
  ".vercel",
  ".netlify",
  "coverage",
  ".nyc_output",
  "*.log",
  "npm-debug.log*",
  "yarn-debug.log*",
  "yarn-error.log*",
  ".DS_Store",
  "Thumbs.db",
  ".cache",
  ".parcel-cache",
  ".vite",
  ".nuxt",
  ".output",
  "__pycache__",
  "*.pyc",
  ".pytest_cache",
  "venv",
  ".venv",
  "*.egg-info",
  "vendor",
  ".idea",
  ".vscode",
  "*.swp",
  "*.swo",
];

export function createProjectZip(
  sourceDir: string,
  outputPath: string,
  excludePatterns: string[] = DEFAULT_EXCLUDE_PATTERNS,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const excludeStr = excludePatterns.map((p) => `-x "${p}"`).join(" ");

    try {
      execSync(
        `cd "${sourceDir}" && zip -r "${outputPath}" . -q ${excludeStr}`,
        { maxBuffer: 50 * 1024 * 1024 }, // 50MB buffer limit
      );
      resolve(outputPath);
    } catch (error: any) {
      reject(new Error(`Failed to create zip: ${error.message}`));
    }
  });
}

export async function deployManual(
  projectId: string,
  zipPath: string,
  framework?: string,
  instanceSize?: ContainerTier,
  replicas?: number,
  envVars?: Array<{ key: string; value: string }>,
  onUploadProgress?: (uploaded: number, total: number) => void,
  buildSettings?: {
    buildCommand?: string;
    outputDirectory?: string;
    installCommand?: string;
  },
): Promise<string> {
  try {
    const uploadRes = await api.uploadFile<any>(
      `/deployments/${projectId}/upload`,
      zipPath,
      "project.zip",
      onUploadProgress,
    );

    const updates: any = {};
    if (instanceSize) updates.instanceSize = instanceSize;
    if (replicas) updates.maxInstances = replicas;
    if (buildSettings?.buildCommand)
      updates.buildCommand = buildSettings.buildCommand;
    if (buildSettings?.outputDirectory)
      updates.outputDirectory = buildSettings.outputDirectory;
    if (buildSettings?.installCommand)
      updates.installCommand = buildSettings.installCommand;

    if (Object.keys(updates).length > 0) {
      await api.patch(`/projects/${projectId}`, updates);
    }

    unlinkSync(zipPath);

    return uploadRes.deploymentId;
  } catch (error: any) {
    if (existsSync(zipPath)) {
      try {
        unlinkSync(zipPath);
      } catch {}
    }
    throw new Error(`Manual deploy failed: ${error.message}`);
  }
}

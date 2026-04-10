export type PodTier = "micro" | "lite" | "standard" | "pro" | "business";

export const TIER_HOURLY_PRICE: Record<PodTier, number> = {
  micro: 0,
  lite: 0.015,
  standard: 0.05,
  pro: 0.08,
  business: 0.12,
};

export type SpendTier = "free" | "low" | "medium" | "high";

export interface TeamLimits {
  maxProjects: number;
  maxInstancesPerProject: number;
  tier: SpendTier;
  tierLabel: string;
}

export const SPEND_THRESHOLDS = {
  free: 0,
  low: 10,
  medium: 50,
  high: 200,
} as const;

export const TIER_LIMITS: Record<SpendTier, TeamLimits> = {
  free: {
    maxProjects: 3,
    maxInstancesPerProject: 1,
    tier: "free",
    tierLabel: "Free Usage",
  },
  low: {
    maxProjects: 10,
    maxInstancesPerProject: 2,
    tier: "low",
    tierLabel: "Low Spend",
  },
  medium: {
    maxProjects: Infinity,
    maxInstancesPerProject: 4,
    tier: "medium",
    tierLabel: "Medium Spend",
  },
  high: {
    maxProjects: Infinity,
    maxInstancesPerProject: 10,
    tier: "high",
    tierLabel: "High Spend",
  },
};

export function getLimitsBySpend(totalSpend: number): TeamLimits {
  if (totalSpend >= SPEND_THRESHOLDS.high) return TIER_LIMITS.high;
  if (totalSpend >= SPEND_THRESHOLDS.medium) return TIER_LIMITS.medium;
  if (totalSpend >= SPEND_THRESHOLDS.low) return TIER_LIMITS.low;
  return TIER_LIMITS.free;
}

export function getTierLabel(totalSpend: number): string {
  return getLimitsBySpend(totalSpend).tierLabel;
}

export type FrameworkFamily = "node" | "nixpacks";
export type DeploymentType = "static" | "container";

export interface FrameworkDefaults {
  buildCommand?: string;
  installCommand?: string;
  outputDirectory?: string;
  startCommand?: string;
}

export interface FrameworkConfig {
  label: string;
  family: FrameworkFamily;
  deploymentType: DeploymentType;
  defaults: FrameworkDefaults;
  isServer: boolean;
}

export const FRAMEWORKS: Record<string, FrameworkConfig> = {
  nextjs: {
    label: "Next.js",
    family: "node",
    deploymentType: "container",
    defaults: {
      buildCommand: "next build",
      installCommand: "bun install",
      outputDirectory: ".next",
    },
    isServer: true,
  },
  remix: {
    label: "Remix",
    family: "node",
    deploymentType: "container",
    defaults: {
      buildCommand: "npm run build",
      installCommand: "bun install",
      outputDirectory: "build",
    },
    isServer: true,
  },
  react: {
    label: "React",
    family: "node",
    deploymentType: "static",
    defaults: {
      buildCommand: "npm run build",
      installCommand: "bun install",
      outputDirectory: "build",
    },
    isServer: false,
  },
  vue: {
    label: "Vue.js",
    family: "node",
    deploymentType: "static",
    defaults: {
      buildCommand: "npm run build",
      installCommand: "bun install",
      outputDirectory: "dist",
    },
    isServer: false,
  },
  nuxt: {
    label: "Nuxt",
    family: "node",
    deploymentType: "container",
    defaults: {
      buildCommand: "npm run build",
      installCommand: "bun install",
      outputDirectory: ".output",
    },
    isServer: true,
  },
  svelte: {
    label: "Svelte",
    family: "node",
    deploymentType: "static",
    defaults: {
      buildCommand: "npm run build",
      installCommand: "bun install",
      outputDirectory: "build",
    },
    isServer: false,
  },
  vite: {
    label: "Vite",
    family: "node",
    deploymentType: "static",
    defaults: {
      buildCommand: "npm run build",
      installCommand: "bun install",
      outputDirectory: "dist",
    },
    isServer: false,
  },
  node: {
    label: "Node.js",
    family: "node",
    deploymentType: "container",
    defaults: {
      buildCommand: "npm run build",
      installCommand: "bun install",
      outputDirectory: "dist",
      startCommand: "node dist/index.js",
    },
    isServer: true,
  },
  express: {
    label: "Express",
    family: "node",
    deploymentType: "container",
    defaults: {
      buildCommand: "npm run build",
      installCommand: "bun install",
      outputDirectory: "dist",
      startCommand: "node dist/index.js",
    },
    isServer: true,
  },
  hono: {
    label: "Hono",
    family: "node",
    deploymentType: "container",
    defaults: {
      buildCommand: "npm run build",
      installCommand: "bun install",
      outputDirectory: "dist",
      startCommand: "node dist/index.js",
    },
    isServer: true,
  },
  nestjs: {
    label: "NestJS",
    family: "node",
    deploymentType: "container",
    defaults: {
      buildCommand: "npm run build",
      installCommand: "bun install",
      outputDirectory: "dist",
      startCommand: "node dist/main.js",
    },
    isServer: true,
  },
  astro: {
    label: "Astro",
    family: "node",
    deploymentType: "static",
    defaults: {
      buildCommand: "npm run build",
      installCommand: "bun install",
      outputDirectory: "dist",
    },
    isServer: false,
  },
  static: {
    label: "Static Site",
    family: "node",
    deploymentType: "static",
    defaults: { buildCommand: "", installCommand: "", outputDirectory: "." },
    isServer: false,
  },
  fastapi: {
    label: "FastAPI",
    family: "nixpacks",
    deploymentType: "container",
    defaults: {
      buildCommand: "uv pip install --python 3.11 -r requirements.txt",
      startCommand: "uvicorn main:app --host 0.0.0.0 --port 8080",
    },
    isServer: true,
  },
  flask: {
    label: "Flask",
    family: "nixpacks",
    deploymentType: "container",
    defaults: {
      buildCommand: "uv pip install --python 3.11 -r requirements.txt",
      startCommand: "flask run --host 0.0.0.0 --port 8080",
    },
    isServer: true,
  },
  django: {
    label: "Django",
    family: "nixpacks",
    deploymentType: "container",
    defaults: {
      buildCommand: "uv pip install --python 3.11 -r requirements.txt",
      startCommand: "python3 manage.py runserver 0.0.0.0:8080",
    },
    isServer: true,
  },
} as const;

export function getFramework(id: string): FrameworkConfig | undefined {
  return FRAMEWORKS[id.toLowerCase()];
}

export function getDefaultBuildCommand(
  frameworkId: string,
): string | undefined {
  return FRAMEWORKS[frameworkId.toLowerCase()]?.defaults.buildCommand;
}

export function getDefaultOutputDirectory(
  frameworkId: string,
): string | undefined {
  return FRAMEWORKS[frameworkId.toLowerCase()]?.defaults.outputDirectory;
}

export function getDefaultStartCommand(
  frameworkId: string,
): string | undefined {
  return FRAMEWORKS[frameworkId.toLowerCase()]?.defaults.startCommand;
}

export function getInstallCommand(
  frameworkId: string,
  packageManager: string,
): string {
  const pm = packageManager.toLowerCase();
  const framework = FRAMEWORKS[frameworkId.toLowerCase()];
  if (pm === "pip" || pm === "poetry") {
    if (pm === "poetry") return "poetry install";
    return (
      framework?.defaults.installCommand || "pip install -r requirements.txt"
    );
  }
  const installCommands: Record<string, string> = {
    npm: "npm install",
    bun: "bun install",
    yarn: "yarn install",
    pnpm: "pnpm install",
  };
  return installCommands[pm] || `${pm} install`;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  repoUrl: string;
  framework: string;
}

export const TEMPLATES: Template[] = [
  {
    id: "blank",
    name: "Blank",
    description: "Minimal project setup",
    repoUrl: "https://github.com/onflyt/blank",
    framework: "static",
  },
  {
    id: "nextjs",
    name: "Next.js Starter",
    description: "Next.js with App Router",
    repoUrl: "https://github.com/onflyt/nextjs-starter",
    framework: "nextjs",
  },
  {
    id: "react-vite",
    name: "React + Vite",
    description: "React with Vite bundler",
    repoUrl: "https://github.com/onflyt/react-vite",
    framework: "react",
  },
  {
    id: "node-api",
    name: "Node.js API",
    description: "Express/Fastify REST API",
    repoUrl: "https://github.com/onflyt/node-api",
    framework: "node",
  },
  {
    id: "fastapi",
    name: "FastAPI",
    description: "Python FastAPI backend",
    repoUrl: "https://github.com/onflyt/fastapi-starter",
    framework: "fastapi",
  },
  {
    id: "ai-agent",
    name: "AI Agent",
    description: "AI Agent starter with OpenAI",
    repoUrl: "https://github.com/onflyt/ai-agent",
    framework: "python",
  },
];

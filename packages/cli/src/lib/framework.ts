import { existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  FRAMEWORKS as SHARED_FRAMEWORKS,
  getFramework,
  getDefaultOutputDirectory,
  FrameworkConfig,
} from "../shared";

export interface Framework {
  id: string;
  name: string;
  buildCommand?: string;
  outputDirectory?: string;
  installCommand?: string;
  startCommand?: string;
}

export const FRAMEWORKS = SHARED_FRAMEWORKS;

export const FRAMEWORK_LIST = Object.entries(SHARED_FRAMEWORKS).map(
  ([id, config]) => ({
    id,
    name: config.label,
    family: config.family,
    isServer: config.isServer,
  }),
);

export class FrameworkDetector {
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  detect(): Framework | null {
    if (
      this.hasFile("next.config.js") ||
      this.hasFile("next.config.mjs") ||
      this.hasFile("next.config.ts")
    ) {
      return this.toFramework("nextjs");
    }

    if (this.hasFile("nuxt.config.ts") || this.hasFile("nuxt.config.js")) {
      return this.toFramework("nuxt");
    }

    if (this.hasFile("package.json")) {
      const pkg = this.readPackageJson();
      if (!pkg) return null;

      if (pkg.dependencies?.next || pkg.devDependencies?.next) {
        return this.toFramework("nextjs");
      }

      if (pkg.dependencies?.react || pkg.devDependencies?.react) {
        if (pkg.dependencies?.remix) return this.toFramework("remix");
        if (pkg.dependencies?.nuxt || pkg.devDependencies?.nuxt)
          return this.toFramework("nuxt");
        if (pkg.dependencies?.svelte || pkg.devDependencies?.svelte)
          return this.toFramework("svelte");
        if (pkg.dependencies?.angular || pkg.devDependencies?.angular)
          return this.toFramework("angular");
        if (pkg.dependencies?.hono || pkg.devDependencies?.hono)
          return this.toFramework("hono");
        if (pkg.dependencies?.nestjs || pkg.devDependencies?.nestjs)
          return this.toFramework("nestjs");
        return this.toFramework("react");
      }

      if (pkg.dependencies?.vue || pkg.devDependencies?.vue) {
        return this.toFramework("vue");
      }

      if (pkg.dependencies?.express || pkg.devDependencies?.express) {
        return this.toFramework("express");
      }

      if (pkg.dependencies?.fastapi || pkg.devDependencies?.fastapi) {
        return this.toFramework("fastapi");
      }

      if (pkg.dependencies?.django || pkg.devDependencies?.django) {
        return this.toFramework("django");
      }

      if (pkg.dependencies?.flask || pkg.devDependencies?.flask) {
        return this.toFramework("flask");
      }

      if (pkg.dependencies?.hono || pkg.devDependencies?.hono) {
        return this.toFramework("hono");
      }

      if (pkg.dependencies?.nestjs || pkg.devDependencies?.nestjs) {
        return this.toFramework("nestjs");
      }

      if (pkg.scripts?.dev || pkg.scripts?.start) {
        return this.toFramework("node");
      }
    }

    if (this.hasFile("requirements.txt") || this.hasFile("Pipfile")) {
      const content =
        this.readFile("requirements.txt") || this.readFile("Pipfile") || "";

      if (content.includes("fastapi")) return this.toFramework("fastapi");
      if (content.includes("django")) return this.toFramework("django");
      if (content.includes("flask")) return this.toFramework("flask");

      return this.toFramework("python");
    }

    if (this.hasFile("go.mod")) {
      return this.toFramework("go");
    }

    if (this.hasFile("Cargo.toml")) {
      return this.toFramework("rust");
    }

    if (this.hasFile("index.html")) {
      return this.toFramework("static");
    }

    if (this.hasFile("Dockerfile")) {
      return this.toFramework("docker");
    }

    return null;
  }

  detectOutputDirectory(frameworkId: string): string | null {
    const lowerId = frameworkId.toLowerCase();

    if (this.hasFile("package.json")) {
      const pkg = this.readPackageJson();
      if (pkg) {
        const scripts = pkg.scripts || {};
        if (scripts.build) {
          if (lowerId === "nextjs") {
            if (this.hasFile(".next")) return ".next";
          }
          if (lowerId === "react" || lowerId === "vue" || lowerId === "vite") {
            if (this.hasFile("dist")) return "dist";
            if (this.hasFile("build")) return "build";
          }
          if (lowerId === "nuxt") {
            if (this.hasFile(".output")) return ".output";
          }
          if (lowerId === "svelte") {
            if (this.hasFile("build")) return "build";
            if (this.hasFile("dist")) return "dist";
          }
          if (lowerId === "astro") {
            if (this.hasFile("dist")) return "dist";
          }
        }
      }
    }

    return getDefaultOutputDirectory(lowerId) || null;
  }

  private toFramework(id: string): Framework {
    const config = SHARED_FRAMEWORKS[id.toLowerCase()];
    if (!config) {
      return { id, name: id };
    }
    return {
      id,
      name: config.label,
      buildCommand: config.defaults.buildCommand,
      outputDirectory: config.defaults.outputDirectory,
      installCommand: config.defaults.installCommand,
      startCommand: config.defaults.startCommand,
    };
  }

  private hasFile(filename: string): boolean {
    return existsSync(join(this.cwd, filename));
  }

  private readFile(filename: string): string | null {
    try {
      const path = join(this.cwd, filename);
      if (existsSync(path)) {
        return readFileSync(path, "utf-8");
      }
    } catch {
      // ignore
    }
    return null;
  }

  private readPackageJson(): {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  } | null {
    try {
      const content = this.readFile("package.json");
      if (content) {
        return JSON.parse(content);
      }
    } catch {
      // ignore
    }
    return null;
  }

  getSuggestions(): Framework[] {
    return Object.entries(SHARED_FRAMEWORKS).map(([id, config]) => ({
      id,
      name: config.label,
      buildCommand: config.defaults.buildCommand,
      outputDirectory: config.defaults.outputDirectory,
      installCommand: config.defaults.installCommand,
      startCommand: config.defaults.startCommand,
    }));
  }
}

export { getFramework } from "../shared";

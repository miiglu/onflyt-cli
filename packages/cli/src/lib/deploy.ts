import { createHash } from "crypto";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, basename } from "path";
import { pipeline } from "stream/promises";
import { createGzip } from "zlib";
import { Readable } from "stream";

export interface DeployProgress {
  stage: "zipping" | "uploading" | "building" | "deployed";
  progress?: number;
  message?: string;
  url?: string;
}

export interface ProjectConfig {
  id?: string;
  name: string;
  teamId: string;
  framework: string;
  buildCommand?: string;
  outputDirectory?: string;
  installCommand?: string;
  startCommand?: string;
  gitRepoUrl?: string;
  gitBranch?: string;
  gitRepoId?: number;
}

export class DeployHelper {
  private cwd: string;
  private onProgress?: (progress: DeployProgress) => void;

  constructor(
    cwd: string = process.cwd(),
    onProgress?: (p: DeployProgress) => void,
  ) {
    this.cwd = cwd;
    this.onProgress = onProgress;
  }

  report(progress: DeployProgress) {
    if (this.onProgress) {
      this.onProgress(progress);
    }
  }

  async createZip(): Promise<Buffer> {
    this.report({
      stage: "zipping",
      progress: 0,
      message: "Creating zip archive...",
    });

    const files: { path: string; data: Buffer }[] = [];
    const ignoreDirs = [
      "node_modules",
      ".git",
      ".next",
      "dist",
      "build",
      ".output",
      ".onflyt",
      ".venv",
      "venv",
      "__pycache__",
      ".cache",
      ".turbo",
      "coverage",
      ".nyc_output",
      "target",
    ];

    const ignoreFiles = [
      ".DS_Store",
      ".gitignore",
      ".env",
      ".env.local",
      ".env.production",
      "*.log",
      "npm-debug.log*",
      "yarn-debug.log*",
      "yarn-error.log*",
    ];

    const walkDir = (dir: string, basePath: string = "") => {
      if (!existsSync(dir)) return;

      const items = readdirSync(dir, { withFileTypes: true });

      for (const item of items) {
        const itemPath = join(dir, item.name);
        const relativePath = basePath ? `${basePath}/${item.name}` : item.name;

        if (item.isDirectory()) {
          if (!ignoreDirs.includes(item.name) && !item.name.startsWith(".")) {
            walkDir(itemPath, relativePath);
          }
        } else {
          const shouldIgnore = ignoreFiles.some((pattern) => {
            if (pattern.startsWith("*")) {
              return item.name.endsWith(pattern.slice(1));
            }
            return item.name === pattern;
          });

          if (!shouldIgnore) {
            try {
              const data = readFileSync(itemPath);
              files.push({ path: relativePath, data });
            } catch {
              // skip files we can't read
            }
          }
        }
      }
    };

    walkDir(this.cwd);

    let content = "";
    for (const file of files) {
      content += `${file.path}:${file.data.toString("base64")}\n`;
    }

    const zipBuffer = await this.gzip(Buffer.from(content, "utf-8"));

    this.report({
      stage: "zipping",
      progress: 100,
      message: `Zipped ${files.length} files`,
    });

    return zipBuffer;
  }

  private gzip(data: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const gzip = createGzip();

      gzip.on("data", (chunk) => chunks.push(chunk));
      gzip.on("end", () => resolve(Buffer.concat(chunks)));
      gzip.on("error", reject);

      Readable.from(data).pipe(gzip);
    });
  }

  async uploadZip(
    zipData: Buffer,
    projectId: string,
    apiUrl: string,
    token: string,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<{ deploymentId: string }> {
    this.report({
      stage: "uploading",
      progress: 0,
      message: "Starting upload...",
    });

    const boundary = `----FormBoundary${createHash("md5").update(Date.now().toString()).digest("hex")}`;

    const body = this.buildMultipartBody(zipData, boundary);
    const totalSize = body.length;

    const response = await fetch(`${apiUrl}/deployments/${projectId}/upload`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${token}`,
      },
      body: new Uint8Array(body),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Upload failed");
    }

    this.report({
      stage: "uploading",
      progress: 100,
      message: "Upload complete",
    });

    return { deploymentId: result.deploymentId };
  }

  private buildMultipartBody(data: Buffer, boundary: string): Buffer {
    const parts: Buffer[] = [];

    const header = Buffer.from(
      `--${boundary}\r\nContent-Type: application/octet-stream\r\nContent-Disposition: form-data; name="file"; filename="source.zip"\r\n\r\n`,
      "utf-8",
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8");

    parts.push(header);
    parts.push(data);
    parts.push(footer);

    return Buffer.concat(parts);
  }

  async pollDeployment(
    deploymentId: string,
    apiUrl: string,
    token: string,
    onStatus?: (status: string, url?: string) => void,
  ): Promise<{ status: string; url?: string }> {
    const maxAttempts = 60;
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const response = await fetch(`${apiUrl}/deployments/${deploymentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await response.json();

      if (result.deployment) {
        const status = result.deployment.status;
        const url = result.deployment.url;

        if (onStatus) {
          onStatus(status, url);
        }

        if (
          status === "active" ||
          status === "deployed" ||
          status === "failed"
        ) {
          return { status, url };
        }
      }

      attempts++;
    }

    return { status: "timeout" };
  }
}

export function validateProjectName(name: string): string | null {
  if (!name || name.length < 3) {
    return "Name must be at least 3 characters";
  }
  if (name.length > 30) {
    return "Name must be less than 30 characters";
  }
  if (!/^[a-z0-9-]+$/.test(name)) {
    return "Name must be lowercase alphanumeric with dashes only";
  }
  return null;
}

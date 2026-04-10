import { API_URL, getConfig } from "./config.js";

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export type ApiResponse<T> = ApiError | ApiSuccess<T>;

export class ApiClient {
  private token: string | null;

  constructor() {
    const config = getConfig();
    this.token = config.token || null;
  }

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const text = await response.text();

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const data = JSON.parse(text);
        errorMessage = data.error || errorMessage;
      } catch {}
      throw new ApiException(errorMessage, response.status);
    }

    if (!text) {
      return {} as T;
    }

    try {
      const data = JSON.parse(text);
      if (data.success === false) {
        throw new ApiException(
          data.error || "Request failed",
          response.status,
          data.code,
        );
      }
      if (data.success === true) {
        return data.data || data;
      }
      return data;
    } catch {
      return text as any;
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  async uploadFile<T>(
    endpoint: string,
    filePath: string,
    filename: string,
    onProgress?: (uploaded: number, total: number) => void,
  ): Promise<T> {
    const { readFileSync } = await import("fs");

    const fileBuffer = readFileSync(filePath);
    const totalSize = fileBuffer.length;

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      body: fileBuffer,
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": String(totalSize),
        Authorization: this.token ? `Bearer ${this.token}` : "",
      },
    });

    const text = await response.text();

    if (!response.ok) {
      let errorMessage = `Upload failed with status ${response.status}`;
      try {
        const data = JSON.parse(text);
        errorMessage = data.error || errorMessage;
      } catch {}
      throw new ApiException(errorMessage, response.status);
    }

    try {
      return JSON.parse(text);
    } catch {
      return text as any;
    }
  }
}

export class ApiException extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiException";
  }
}

export const api = new ApiClient();

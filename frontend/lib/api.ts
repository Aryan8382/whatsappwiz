export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type User = {
  sub: number;
  email: string;
  organizationId: number;
  role: string;
};

const TOKEN_KEY = "ww_access_token";
const USER_KEY = "ww_user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getSessionUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export class ApiError extends Error {
  status: number;
  errors?: string[];
  constructor(message: string, status: number, errors?: string[]) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearSession();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    throw new ApiError("Unauthorized", 401);
  }

  const isCsv = res.headers.get("content-type")?.includes("text/csv");
  if (isCsv) return (await res.text()) as unknown as T;

  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await res.json() : null;

  if (!res.ok) {
    const message = body?.message || `Request failed (${res.status})`;
    throw new ApiError(message, res.status, body?.errors);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(data ?? {}) }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(data ?? {}) }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(data ?? {}) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: async <T = any>(fileOrPath: File | string, formDataOverride?: FormData): Promise<T> => {
    const token = getToken();
    let url = `${API_URL}/api/v1/upload`;
    let body: FormData;
    if (typeof fileOrPath === "string") {
      url = `${API_URL}/api/v1${fileOrPath}`;
      body = formDataOverride || new FormData();
    } else {
      body = new FormData();
      body.append("file", fileOrPath);
    }
    const res = await fetch(url, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(err.message || "Upload failed", res.status);
    }
    const json = await res.json();
    return (json.data !== undefined ? json.data : json) as T;
  },
  text: async (path: string) => {
    const token = getToken();
    const res = await fetch(`${API_URL}/api/v1${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new ApiError("Request failed", res.status);
    return res.text();
  },
};

export async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new ApiError(body.message || "Login failed", res.status, body.errors);
  setSession(body.accessToken, body.user);
  return body;
}

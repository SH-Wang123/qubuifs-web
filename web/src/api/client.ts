import type { ApiResponse } from '@/types/api';
import { useDebugStore } from '@/stores/debug';

/**
 * loggedFetch：拦截所有 fetch 请求，记录请求/响应到调试 store。
 * 仅在调试开关 enabled 时记录（store 内部判断）。
 */
export async function loggedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const start = performance.now();
  const method = (init?.method ?? 'GET').toUpperCase();
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const reqBody = init?.body ? safeStringify(init.body) : null;

  try {
    const resp = await fetch(input, init);
    const elapsed = Math.round(performance.now() - start);
    const clone = resp.clone();
    let respBody: string | null = null;
    try {
      respBody = await clone.text();
    } catch {
      respBody = null;
    }
    useDebugStore.getState().appendLog({
      ts: new Date().toISOString(),
      method,
      url,
      status: resp.status,
      elapsed,
      reqBody,
      respBody,
    });
    return resp;
  } catch (err) {
    const elapsed = Math.round(performance.now() - start);
    const errMsg = err instanceof Error ? err.message : String(err);
    useDebugStore.getState().appendLog({
      ts: new Date().toISOString(),
      method,
      url,
      status: 0,
      elapsed,
      reqBody,
      respBody: null,
      error: errMsg,
    });
    throw err;
  }
}

function safeStringify(body: BodyInit): string {
  if (typeof body === 'string') return body;
  if (body instanceof URLSearchParams) return body.toString();
  if (body instanceof FormData) {
    const obj: Record<string, string> = {};
    body.forEach((v, k) => {
      obj[k] = typeof v === 'string' ? v : v.name;
    });
    return JSON.stringify(obj);
  }
  if (body instanceof Blob) return `<Blob size=${body.size} type=${body.type}>`;
  if (body instanceof ArrayBuffer) return `<ArrayBuffer byteLength=${body.byteLength}>`;
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

/**
 * 调用控制面透传接口（/api/control/*）。
 * 网关会把请求转发给控制面，并把控制面的 ApiResponse 透传回来。
 *
 * 失败时抛出 ApiError，错误信息包含 code/message/detail。
 */
export class ApiError extends Error {
  code: number;
  httpStatus: number;
  detail?: string;
  constructor(message: string, code: number, httpStatus: number, detail?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.detail = detail;
  }
}

/**
 * 调用 /api/control/* 透传接口并解析为 ApiResponse<T>。
 *
 * @param path 控制面路径，以 `/` 开头，例如 `/qubuifs`、`/nodes/foo/status`。
 *              不要包含 `/api/control` 前缀，本函数会自动拼接。
 */
export async function controlRequest<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = path.startsWith('/') ? `/api/control${path}` : `/api/control/${path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.body && !headers['Content-Type'] && typeof init.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  const resp = await loggedFetch(url, { ...init, headers });
  let raw: string | null = null;
  try {
    raw = await resp.text();
  } catch {
    /* ignore */
  }

  if (!raw) {
    throw new ApiError(
      resp.statusText || `HTTP ${resp.status}`,
      -1,
      resp.status,
      '控制面返回空响应',
    );
  }

  let parsed: ApiResponse<T>;
  try {
    parsed = JSON.parse(raw) as ApiResponse<T>;
  } catch {
    throw new ApiError(
      'invalid JSON response',
      -1,
      resp.status,
      raw.slice(0, 500),
    );
  }

  if (parsed.code !== 0) {
    throw new ApiError(
      parsed.message || 'control plane error',
      parsed.code,
      resp.status,
      parsed.data ? JSON.stringify(parsed.data) : undefined,
    );
  }

  return parsed.data as T;
}

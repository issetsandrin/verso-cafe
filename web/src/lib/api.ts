export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Quando true, envia como FormData (upload). */
  formData?: FormData;
}

export async function apiFetch<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, formData } = options;

  const init: RequestInit = {
    method,
    credentials: "include",
    headers: {},
  };

  if (formData) {
    init.body = formData;
  } else if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}/api${path}`, init);

  let data: unknown = null;
  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    data = await res.json().catch(() => null);
  }

  if (!res.ok) {
    const message =
      (data as { error?: string })?.error || `Erro na requisição (${res.status}).`;
    throw new ApiError(message, res.status);
  }

  return data as T;
}

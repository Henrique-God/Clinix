export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: BodyInit | object | null;
  token?: string;
}

export async function requestJson<TResponse>(
  baseUrl: string,
  path: string,
  options: RequestOptions = {},
): Promise<TResponse> {
  const headers = new Headers(options.headers);

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  let body: BodyInit | undefined;
  if (
    options.body !== undefined &&
    options.body !== null &&
    !(options.body instanceof FormData) &&
    !(options.body instanceof Blob) &&
    typeof options.body !== "string"
  ) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  } else if (options.body !== null && options.body !== undefined) {
    body = options.body as BodyInit;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    body,
  });

  if (response.status === 204) {
    return undefined as TResponse;
  }

  const rawContentType = response.headers.get("Content-Type") ?? "";
  const isJson = rawContentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "string"
        ? payload
        : (payload as { title?: string; detail?: string; message?: string })
            ?.detail ??
          (payload as { title?: string; detail?: string; message?: string })
            ?.message ??
          (payload as { title?: string }).title ??
          "Não foi possível concluir a requisição.";

    throw new ApiError(message, response.status, payload);
  }

  return payload as TResponse;
}

export async function requestBlob(
  baseUrl: string,
  path: string,
  options: RequestOptions = {},
) {
  const headers = new Headers(options.headers);

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorPayload = await response.text();
    throw new ApiError(
      errorPayload || "Não foi possível baixar o arquivo.",
      response.status,
      errorPayload,
    );
  }

  return response.blob();
}

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
  timeoutMs?: number;
}

const defaultRequestTimeoutMs = 15000;

function buildRequestSignal(timeoutMs: number, externalSignal?: AbortSignal | null) {
  const controller = new AbortController();
  let timedOut = false;

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const abortFromExternalSignal = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", abortFromExternalSignal);
    }
  }

  function cleanup() {
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", abortFromExternalSignal);
    }
  }

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup,
  };
}

function mapFetchError(error: unknown, didTimeout: boolean) {
  if (error instanceof Error && error.name === "AbortError") {
    if (didTimeout) {
      return new ApiError(
        "A requisicao demorou mais que o esperado. Tente novamente.",
        408,
        null,
      );
    }

    return new ApiError("A requisicao foi cancelada.", 499, null);
  }

  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof Error) {
    return new ApiError(error.message, 0, null);
  }

  return new ApiError("Nao foi possivel concluir a requisicao.", 0, null);
}

export async function requestJson<TResponse>(
  baseUrl: string,
  path: string,
  options: RequestOptions = {},
): Promise<TResponse> {
  const {
    timeoutMs = defaultRequestTimeoutMs,
    signal,
    token,
    body: requestBody,
    headers: requestHeaders,
    ...fetchOptions
  } = options;
  const headers = new Headers(requestHeaders);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let body: BodyInit | undefined;
  if (
    requestBody !== undefined &&
    requestBody !== null &&
    !(requestBody instanceof FormData) &&
    !(requestBody instanceof Blob) &&
    typeof requestBody !== "string"
  ) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(requestBody);
  } else if (requestBody !== null && requestBody !== undefined) {
    body = requestBody as BodyInit;
  }

  const requestSignal = buildRequestSignal(timeoutMs, signal);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...fetchOptions,
      headers,
      body,
      signal: requestSignal.signal,
    });
  } catch (error) {
    throw mapFetchError(error, requestSignal.didTimeout());
  } finally {
    requestSignal.cleanup();
  }

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
          "Nao foi possivel concluir a requisicao.";

    throw new ApiError(message, response.status, payload);
  }

  return payload as TResponse;
}

export async function requestBlob(
  baseUrl: string,
  path: string,
  options: RequestOptions = {},
) {
  const {
    timeoutMs = defaultRequestTimeoutMs,
    signal,
    token,
    headers: requestHeaders,
    ...fetchOptions
  } = options;
  const headers = new Headers(requestHeaders);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const requestSignal = buildRequestSignal(timeoutMs, signal);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...fetchOptions,
      headers,
      signal: requestSignal.signal,
    });
  } catch (error) {
    throw mapFetchError(error, requestSignal.didTimeout());
  } finally {
    requestSignal.cleanup();
  }

  if (!response.ok) {
    const errorPayload = await response.text();
    throw new ApiError(
      errorPayload || "Nao foi possivel baixar o arquivo.",
      response.status,
      errorPayload,
    );
  }

  return response.blob();
}

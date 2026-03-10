type RuntimeError = {
  message: string;
};

function getRuntimeBaseUrl() {
  return window.klava?.runtimeUrl ?? import.meta.env.VITE_RUNTIME_URL ?? "/api";
}

export async function requestJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${getRuntimeBaseUrl()}${path}`, {
    headers: {
      "content-type": "application/json",
    },
    ...init,
  });

  const payload = (await response.json()) as T | RuntimeError;
  if (!response.ok) {
    const errorMessage =
      typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : "Request failed";
    throw new Error(errorMessage);
  }

  return payload as T;
}

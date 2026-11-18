/**
 * A fake `fetch` for unit tests: routes each request to `handler` and records
 * "METHOD url" for every call, so tests can assert the order of requests.
 * A handler that throws simulates a network failure (no HTTP status); one that
 * returns a pending promise holds the response until the test releases it.
 */
export function fakeFetch(handler: (request: Request) => Response | Promise<Response>) {
  const calls: string[] = [];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    calls.push(`${request.method} ${request.url}`);
    return handler(request);
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

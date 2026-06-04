import { afterEach, describe, expect, it, vi } from 'vitest';
import { isNetworkError, waitForServer } from '../src/cli/dev.js';

// ---------------------------------------------------------------------------
// isNetworkError
// ---------------------------------------------------------------------------

describe('isNetworkError', () => {
  it('returns true for TypeError (fetch network failure)', () => {
    expect(isNetworkError(new TypeError('fetch failed'))).toBe(true);
  });

  it('returns true for ECONNREFUSED errors', () => {
    expect(isNetworkError(new Error('connect ECONNREFUSED 127.0.0.1:8090'))).toBe(true);
  });

  it('returns true for ENOTFOUND errors', () => {
    expect(isNetworkError(new Error('getaddrinfo ENOTFOUND localhost'))).toBe(true);
  });

  it('returns false for HTTP-level errors (server is up, request failed)', () => {
    expect(isNetworkError(new Error('Authentication failed (401): invalid credentials'))).toBe(false);
    expect(isNetworkError(new Error('Import failed (422): validation error'))).toBe(false);
    expect(isNetworkError(new Error('Failed to list collections (500): internal error'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isNetworkError('string error')).toBe(false);
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
    expect(isNetworkError(42)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// waitForServer
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllTimers();
});

describe('waitForServer', () => {
  it('resolves as soon as the health endpoint returns ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true }) as typeof fetch;
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    vi.useFakeTimers();
    const p = waitForServer('http://localhost:8090');
    await vi.advanceTimersByTimeAsync(2001);
    await p;

    expect(globalThis.fetch).toHaveBeenCalledOnce();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:8090/api/health',
      expect.any(Object),
    );
  });

  it('strips trailing slashes before appending the health path', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true }) as typeof fetch;
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    vi.useFakeTimers();
    const p = waitForServer('http://localhost:8090///');
    await vi.advanceTimersByTimeAsync(2001);
    await p;

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:8090/api/health',
      expect.any(Object),
    );
  });

  it('writes a dot for each failed fetch attempt and resolves when server is up', async () => {
    let calls = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls < 3) throw new TypeError('fetch failed');
      return { ok: true };
    }) as typeof fetch;

    const written: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    vi.useFakeTimers();
    const p = waitForServer('http://localhost:8090');
    await vi.advanceTimersByTimeAsync(2001); // tick 1 → fails → dot
    await vi.advanceTimersByTimeAsync(2001); // tick 2 → fails → dot
    await vi.advanceTimersByTimeAsync(2001); // tick 3 → ok → done
    await p;

    const dots = written.filter((s) => s.includes('·'));
    expect(dots).toHaveLength(2);
    expect(written.at(-1)).toBe('\n');
  });

  it('retries when the health endpoint returns a non-ok status', async () => {
    let calls = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      calls++;
      return { ok: calls >= 2 };
    }) as typeof fetch;

    vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    vi.useFakeTimers();
    const p = waitForServer('http://localhost:8090');
    await vi.advanceTimersByTimeAsync(2001); // tick 1 → non-ok
    await vi.advanceTimersByTimeAsync(2001); // tick 2 → ok
    await p;

    expect(calls).toBe(2);
  });

  it('writes the initial waiting message before polling begins', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true }) as typeof fetch;

    const written: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    vi.useFakeTimers();
    const p = waitForServer('http://localhost:8090');
    // The header is written synchronously before any tick
    expect(written[0]).toContain('waiting for server to come back');

    await vi.advanceTimersByTimeAsync(2001);
    await p;
  });
});

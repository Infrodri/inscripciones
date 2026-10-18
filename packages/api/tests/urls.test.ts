import { describe, expect, it } from 'vitest';
import { resolveOrigin } from '../src/shared/urls.js';

describe('resolveOrigin', () => {
  const fallback = 'http://localhost:3000';

  it('uses query origin if valid', () => {
    const origin = resolveOrigin(
      { query: { origin: 'https://eventos-usfx.vercel.app' } },
      fallback
    );
    expect(origin).toBe('https://eventos-usfx.vercel.app');
  });

  it('strips paths and trailing slashes from query origin', () => {
    const origin = resolveOrigin(
      { query: { origin: 'https://eventos-usfx.vercel.app/subpath/' } },
      fallback
    );
    expect(origin).toBe('https://eventos-usfx.vercel.app');
  });

  it('uses header origin when query origin is absent', () => {
    const origin = resolveOrigin(
      { headers: { origin: 'https://custom-domain.edu.bo' } },
      fallback
    );
    expect(origin).toBe('https://custom-domain.edu.bo');
  });

  it('extracts origin from header referer when origin is absent', () => {
    const origin = resolveOrigin(
      { headers: { referer: 'https://preview-branch.vercel.app/admin/events/conferencia-2026' } },
      fallback
    );
    expect(origin).toBe('https://preview-branch.vercel.app');
  });

  it('falls back when no origin or referer is provided', () => {
    const origin = resolveOrigin({}, 'http://localhost:3000/');
    expect(origin).toBe('http://localhost:3000');
  });

  it('ignores invalid or non-http protocol candidates and uses fallback', () => {
    const origin = resolveOrigin(
      { query: { origin: 'javascript:alert(1)' } },
      fallback
    );
    expect(origin).toBe('http://localhost:3000');
  });
});

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

process.env.NEXT_PUBLIC_API_URL ??= 'http://localhost:3001/api/v1';

afterEach(() => {
  cleanup();
});

import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.FlatConfig[]} */
const config = tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.next/**', '**/uploads/**'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.mjs', '**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Scripts CLI (smoke, create-admin): la consola es la salida.
    files: ['scripts/**/*.ts', 'packages/api/scripts/**/*.ts', 'packages/api/prisma/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  }
);

export default config;

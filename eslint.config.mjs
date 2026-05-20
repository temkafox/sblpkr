import eslint from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const boundaryRules = {
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: ['apps/*', '**/apps/*'],
          message: 'Packages must not import from apps.',
        },
        {
          group: ['@neonpoker/poker-core', '@neonpoker/poker-core/*'],
          message: 'poker-core is server-only in this monorepo.',
        },
      ],
    },
  ],
};

const pokerCoreBoundaryRules = {
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: ['apps/*', '**/apps/*'],
          message: 'poker-core must not import from apps.',
        },
        {
          group: ['react', 'react-dom', 'react/*'],
          message: 'poker-core must stay free of React.',
        },
        {
          group: ['@nestjs/*'],
          message: 'poker-core must stay free of NestJS.',
        },
        {
          group: ['socket.io', 'socket.io-client', 'socket.io/*'],
          message: 'poker-core must stay free of Socket.IO.',
        },
        {
          group: ['@prisma/*', 'prisma'],
          message: 'poker-core must stay free of Prisma.',
        },
      ],
    },
  ],
};

const webBoundaryRules = {
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: ['@neonpoker/poker-core', '@neonpoker/poker-core/*'],
          message: 'Web must not import poker-core. Use @neonpoker/shared only.',
        },
        {
          group: ['@neonpoker/server', 'apps/server', '**/apps/server/**'],
          message: 'Web must not import the server app.',
        },
      ],
    },
  ],
};

const serverBoundaryRules = {
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: ['@neonpoker/web', 'apps/web', '**/apps/web/**'],
          message: 'Server must not import the web app.',
        },
      ],
    },
  ],
};

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', 'design/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'import/no-internal-modules': [
        'error',
        {
          forbid: ['@neonpoker/shared/src/**', '@neonpoker/poker-core/src/**'],
        },
      ],
    },
  },
  {
    files: ['packages/shared/**/*.ts'],
    rules: boundaryRules,
  },
  {
    files: ['packages/poker-core/**/*.ts'],
    rules: pokerCoreBoundaryRules,
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: webBoundaryRules,
  },
  {
    files: ['apps/server/**/*.ts'],
    rules: serverBoundaryRules,
  },
);

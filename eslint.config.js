import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

// El proyecto es JavaScript/JSX (no TypeScript). Antes este fichero solo apuntaba a
// `**/*.{ts,tsx}`, así que cubría UN fichero de 36 y el 97% del código nunca pasaba
// por lint. Ahora cada zona se lintea con su entorno real: navegador en src/,
// Node+CommonJS en functions/, Node+ESM en scripts/, y ambos en los tests.
export default defineConfig([
  globalIgnores([
    'dist',
    'android',
    'ios',
    // Utilería de Claude Code / claude-flow: no es código del proyecto.
    '.claude',
    'jdk21',
    'deploy_tmp',
    'public',
    'functions/node_modules',
  ]),

  // ── App (navegador) ────────────────────────────────────────────────────────
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        // Lo inyecta Vite (define) desde la versión de package.json — ver vite.config.
        __APP_VERSION__: 'readonly',
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // eslint-plugin-react-hooks v7 mete las reglas del React Compiler dentro de
      // su config "recommended". Este proyecto NO usa el compilador (no hay
      // babel-plugin-react-compiler en vite.config), así que estas dos son
      // ADVISORIAS: avisan de renders en cascada y de memoizaciones que el
      // compilador no sabría preservar. Se dejan en 'warn' —visibles, no
      // silenciadas— porque reescribir efectos que funcionan en producción tiene
      // hoy más riesgo que beneficio. Si algún día se adopta el compilador, hay
      // que resolverlas antes. Las clásicas (rules-of-hooks, refs) siguen en error.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },

  // ── Cloud Functions (Node, CommonJS) ───────────────────────────────────────
  {
    files: ['functions/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: globals.node,
    },
  },

  // ── Scripts de mantenimiento y config del build (Node) ─────────────────────
  {
    files: ['scripts/**/*.js', '*.config.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
  },

  // ── Tests (Vitest: Node + APIs de navegador) ───────────────────────────────
  {
    files: ['tests/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
  },
])

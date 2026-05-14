import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'

export default defineConfig(
  {
    ignores: ['**/node_modules', '**/dist', '**/out', 'scripts/**', '.claude/**', '**/.claude/**']
  },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules,
      // v2.3.1 — escalado de `warn` (default de la regla) a `error`. El
      // informe de seguridad sobre 24ea88b mostró un stale closure en
      // `handleSubmit` del pedido directo: editar el nombre de un trabajo
      // sin tocar items dejaba el callback con la referencia vieja de
      // `trabajos`, y el IPC enviaba `trabajoNombre` desactualizado.
      // La auditoría reveló 2 bugs hermanos en otros archivos. CI con
      // `--max-warnings 0` no se usa hoy, así que estos warnings entraban
      // silenciosos. Promoverlo a `error` los bloquea en `npm run lint`.
      //
      // Casos legítimos para omitir una dep: agregar
      // `// eslint-disable-next-line react-hooks/exhaustive-deps` en la
      // línea anterior con comentario explicando POR QUÉ (ej. ref estable
      // que React no sabe inferir). Ver overrides abajo para help-button
      // y update-notification.
      'react-hooks/exhaustive-deps': 'error',
      // Relajamos explicit-function-return-type: TypeScript los infiere
      // correctamente y forzarlos en cada componente React agrega ruido
      // sin beneficio. Los tipos en API boundaries (IPC handlers, queries)
      // se siguen anotando manualmente por convención del repo.
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  },
  // Overrides para componentes flotantes (popover de ayuda, banner del
  // updater) que resetean su estado interno al cambiar de ruta. El patrón
  // "setState en useEffect con [pathname] como única dep" es intencional:
  // NO queremos `open` en deps porque causaría un loop (bug real de v1.4.0
  // del HelpButton). Las reglas react-hooks/set-state-in-effect y
  // exhaustive-deps flaguean este patrón genéricamente, pero aquí es
  // correcto por diseño. Lo acotamos a estos 2 archivos específicos.
  {
    files: ['**/components/layout/help-button.tsx', '**/components/layout/update-notification.tsx'],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/exhaustive-deps': 'off'
    }
  },
  eslintConfigPrettier
)

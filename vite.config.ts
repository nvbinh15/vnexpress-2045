import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mdx from '@mdx-js/rollup'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    {
      enforce: 'pre',
      ...mdx({
        providerImportSource: '@mdx-js/react',
        // For v1 we only need the raw frontmatter on the front page.
        // Constrain MDX compilation to src/, leaving content/articles/*.mdx
        // as raw text we parse ourselves at build/dev time.
        include: ['src/**/*.{md,mdx}'],
      }),
    },
    react(),
  ],
  assetsInclude: ['**/*.mdx'],
  server: {
    fs: {
      // Allow serving files from outside the project root (content/ at repo root)
      allow: ['..', '.'],
    },
  },
})

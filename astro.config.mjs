// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

const siteUrl = process.env.SITE_URL ? new URL(process.env.SITE_URL) : undefined;

export default defineConfig({
  site: siteUrl?.origin || undefined,
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  security: {
    checkOrigin: true,
    ...(siteUrl
      ? {
          allowedDomains: [
            {
              protocol: siteUrl.protocol.replace(':', ''),
              hostname: siteUrl.hostname,
              ...(siteUrl.port ? { port: siteUrl.port } : {}),
            },
          ],
        }
      : {}),
  },
  vite: {
    plugins: [tailwindcss()],
  },
});

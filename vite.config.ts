import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'

function proxyMiddleware(): Plugin {
  return {
    name: 'api-proxy-middleware',
    configureServer(server) {
      server.middlewares.use('/api-proxy', async (req, res) => {
        const targetUrl = req.headers['x-target-url'] as string
        if (!targetUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Missing x-target-url header' }))
          return
        }

        // Basic URL validation (SSRF mitigation for personal use)
        let parsed: URL
        try {
          parsed = new URL(targetUrl)
          if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new Error('Invalid protocol')
          }
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid target URL' }))
          return
        }

        // Collect request body
        const chunks: Buffer[] = []
        for await (const chunk of req) {
          chunks.push(chunk as Buffer)
        }
        const body = Buffer.concat(chunks)

        // Build forwarded headers (skip hop-by-hop and proxy headers)
        const skipHeaders = new Set([
          'host', 'connection', 'x-target-url', 'transfer-encoding',
          'keep-alive', 'proxy-authenticate', 'proxy-authorization',
          'te', 'trailer', 'upgrade',
        ])
        const headers: Record<string, string> = {}
        for (const [key, value] of Object.entries(req.headers)) {
          if (!skipHeaders.has(key.toLowerCase()) && typeof value === 'string') {
            headers[key] = value
          }
        }

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 30000)

        try {
          const response = await fetch(targetUrl, {
            method: req.method || 'GET',
            headers,
            body: ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : body,
            signal: controller.signal,
            redirect: 'follow',
          })

          clearTimeout(timeout)

          // Forward status and headers
          const responseHeaders: Record<string, string> = {}
          response.headers.forEach((value, key) => {
            responseHeaders[key] = value
          })
          // Add CORS headers for the dev server
          responseHeaders['access-control-allow-origin'] = '*'

          res.writeHead(response.status, responseHeaders)

          if (response.body) {
            const reader = response.body.getReader()
            const pump = async () => {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                res.write(value)
              }
              res.end()
            }
            await pump()
          } else {
            res.end()
          }
        } catch (err: unknown) {
          clearTimeout(timeout)
          if (err instanceof Error && err.name === 'AbortError') {
            res.writeHead(504, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Gateway Timeout: target server did not respond within 30s' }))
          } else {
            const message = err instanceof Error ? err.message : 'Unknown error'
            res.writeHead(502, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: `Bad Gateway: ${message}` }))
          }
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), proxyMiddleware()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

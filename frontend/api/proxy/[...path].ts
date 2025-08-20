// api/proxy/[...path].ts  (Vercel serverless function)
import type { VercelRequest, VercelResponse } from '@vercel/node'

const TARGET = 'https://adapt-v3.onrender.com'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const path = req.query.path
    const suffix = Array.isArray(path) ? path.join('/') : String(path || '')
    const url = `${TARGET}/api/${suffix}`

    // Pass through method, headers (minus host), body
    const headers = new Headers()
    for (const [k, v] of Object.entries(req.headers)) {
      if (!v) continue
      if (k.toLowerCase() === 'host') continue
      headers.set(k, Array.isArray(v) ? v.join(',') : v)
    }

    const init: RequestInit = {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method || '') ? undefined : req.body
    }

    const upstream = await fetch(url, init)

    // Mirror status + headers
    res.status(upstream.status)
    upstream.headers.forEach((v, k) => res.setHeader(k, v))
    const buf = Buffer.from(await upstream.arrayBuffer())
    res.send(buf)
  } catch (e: any) {
    res.status(502).json({ success: false, error: 'proxy_failed', details: e?.message })
  }
}

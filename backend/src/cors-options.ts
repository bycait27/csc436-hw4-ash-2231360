import type { RequestHandler } from 'express'

const allowedMethods = ['GET', 'POST', 'PATCH', 'DELETE'] as const
const allowedHeaders = ['content-type', 'x-request-id'] as const

export function parseCorsOrigins(value: string | undefined): Set<string> {
  if (!value?.trim()) {
    throw new Error('CORS_ORIGINS must contain one or more comma-separated origins.')
  }

  const origins = value.split(',').map((origin) => origin.trim())
  if (origins.some((origin) => origin === '' || origin === '*')) {
    throw new Error('CORS_ORIGINS must contain exact origins and cannot contain "*".')
  }

  for (const origin of origins) {
    let parsed: URL
    try {
      parsed = new URL(origin)
    } catch {
      throw new Error(`Invalid CORS origin "${origin}".`)
    }
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.origin !== origin ||
      parsed.username !== '' ||
      parsed.password !== ''
    ) {
      throw new Error(`CORS origin "${origin}" must be an exact HTTP(S) origin without a path.`)
    }
  }

  return new Set(origins)
}

export function corsMiddleware(origins: ReadonlySet<string>): RequestHandler {
  return (req, res, next) => {
    res.vary('Origin')
    const origin = req.get('Origin')
    const isAllowedOrigin = origin !== undefined && origins.has(origin)

    if (isAllowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Expose-Headers', 'Location, X-Request-Id')
    }

    const requestedMethod = req.get('Access-Control-Request-Method')
    if (req.method !== 'OPTIONS' || requestedMethod === undefined) {
      next()
      return
    }

    if (!isAllowedOrigin) {
      res.status(204).end()
      return
    }

    const requestedHeaders = (req.get('Access-Control-Request-Headers') ?? '')
      .split(',')
      .map((header) => header.trim().toLowerCase())
      .filter(Boolean)
    const method = requestedMethod.toUpperCase()
    if (
      !allowedMethods.some((allowedMethod) => allowedMethod === method) ||
      requestedHeaders.some((header) => !allowedHeaders.some((allowedHeader) => allowedHeader === header))
    ) {
      res.status(403).end()
      return
    }

    res.setHeader('Access-Control-Allow-Methods', allowedMethods.join(', '))
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Request-Id')
    res.setHeader('Access-Control-Max-Age', '600')
    res.status(204).end()
  }
}

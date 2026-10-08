import axios from 'axios'

export const API_URL =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api'

export const api = axios.create({
  baseURL: API_URL,
  timeout: 4000,
  headers: { Accept: 'application/json' },
})

export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'canceled'
export interface ApiErrorDetail {
  field: string
  message: string
}

export class ApiError extends Error {
  public kind: ApiErrorKind
  public status?: number
  public code?: string
  public details: ApiErrorDetail[]
  public requestId?: string

  constructor(
    kind: ApiErrorKind,
    message: string,
    status?: number,
    code?: string,
    details: ApiErrorDetail[] = [],
    requestId?: string,
  ) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
    this.code = code
    this.details = details
    this.requestId = requestId
  }
}

interface ErrorBody {
  error?: {
    code?: unknown
    message?: unknown
    details?: unknown
  }
}

function errorDetails(value: unknown): ApiErrorDetail[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is ApiErrorDetail =>
      typeof item === 'object' &&
      item !== null &&
      'field' in item &&
      typeof item.field === 'string' &&
      'message' in item &&
      typeof item.message === 'string',
  )
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (axios.isCancel(error)) {
    return new ApiError('canceled', 'Request canceled.')
  }
  if (!axios.isAxiosError<ErrorBody>(error)) {
    return new ApiError('network', "Can't reach the server. Check that the API is running and CORS allows this page.")
  }
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return new ApiError('timeout', 'The request timed out. Please retry.')
  }
  if (error.response) {
    const body = error.response.data?.error
    const requestId = error.response.headers?.['x-request-id']
    return new ApiError(
      'http',
      typeof body?.message === 'string' ? body.message : error.message,
      error.response.status,
      typeof body?.code === 'string' ? body.code : undefined,
      errorDetails(body?.details),
      typeof requestId === 'string' ? requestId : undefined,
    )
  }
  return new ApiError('network', "Can't reach the server. Check that the API is running and CORS allows this page.")
}

api.interceptors.request.use((config) => {
  config.headers.set('X-Request-Id', crypto.randomUUID())
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(toApiError(error)),
)

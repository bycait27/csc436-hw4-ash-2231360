import axios from 'axios'
import { describe, expect, it } from 'vitest'
import { ApiError, toApiError } from '../src/api/client'

describe('API error normalization', () => {
  it('preserves server message, status, code, field details, and request ID for HTTP errors', () => {
    const error = toApiError({
      isAxiosError: true,
      message: 'Request failed with status code 400',
      response: {
        status: 400,
        data: {
          error: {
            code: 'invalid_ticket',
            message: 'Ticket does not satisfy the data contract.',
            details: [{ field: 'opened_on', message: 'Opened date is invalid.' }],
          },
        },
        headers: { 'x-request-id': 'request-123' },
      },
    })

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      kind: 'http',
      status: 400,
      code: 'invalid_ticket',
      message: 'Ticket does not satisfy the data contract.',
      details: [{ field: 'opened_on', message: 'Opened date is invalid.' }],
      requestId: 'request-123',
    })
  })

  it('classifies timeouts, unreachable servers, and cancellations distinctly', () => {
    expect(toApiError({
      isAxiosError: true,
      code: 'ECONNABORTED',
      message: 'timeout',
    })).toMatchObject({ kind: 'timeout' })

    expect(toApiError({
      isAxiosError: true,
      message: 'Network Error',
    })).toMatchObject({ kind: 'network' })

    expect(toApiError(new axios.CanceledError())).toMatchObject({ kind: 'canceled' })
  })
})

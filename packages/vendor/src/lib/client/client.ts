import { createClient, InferClient } from '@mercurjs/client'
import { Routes } from '@mercurjs/core/_generated'
import config from 'virtual:mercur/config'

const resolveBackendUrl = () => {
  const configured = config.backendUrl
  const browserOrigin =
    typeof window !== 'undefined' ? window.location.origin : undefined

  if (!configured) {
    return browserOrigin ?? 'http://localhost:9000'
  }

  if (!browserOrigin) {
    return configured
  }

  try {
    const configuredUrl = new URL(configured)
    const originUrl = new URL(browserOrigin)
    const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
    const bothLoopback =
      loopbackHosts.has(configuredUrl.hostname) &&
      loopbackHosts.has(originUrl.hostname)
    const sameLoopbackPort =
      bothLoopback &&
      configuredUrl.port === originUrl.port &&
      configuredUrl.hostname !== originUrl.hostname

    if (sameLoopbackPort) {
      return browserOrigin
    }

    if (bothLoopback && configuredUrl.hostname !== originUrl.hostname) {
      configuredUrl.hostname = originUrl.hostname
      return configuredUrl.origin
    }

    return configured
  } catch {
    return configured
  }
}

export const backendUrl = resolveBackendUrl()

export const sdk: InferClient<Routes> = createClient({
  baseUrl: backendUrl,
  fetchOptions: {
    credentials: 'include',
  },
})

const SELLER_ID_HEADER = 'x-seller-id'
const SELLER_ID_STORAGE_KEY = 'dijie.vendor.current_seller_id'

type SellerMemberListResponse = {
  seller_members?: Array<{
    seller_id?: string
    seller?: {
      id?: string
    }
  }>
}

const readStoredSellerId = () => {
  try {
    return window.localStorage?.getItem(SELLER_ID_STORAGE_KEY) || undefined
  } catch {
    return undefined
  }
}

export const storeSellerId = (sellerId: string) => {
  try {
    window.localStorage?.setItem(SELLER_ID_STORAGE_KEY, sellerId)
  } catch {
    // Storage can be unavailable in embedded previews; the request can still
    // proceed with session seller context.
  }
}

const fetchFirstSellerId = async () => {
  const response = await fetch(`${backendUrl}/vendor/sellers`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    return undefined
  }

  const data = (await response.json()) as SellerMemberListResponse
  const firstSellerId =
    data.seller_members?.[0]?.seller_id || data.seller_members?.[0]?.seller?.id

  if (firstSellerId) {
    storeSellerId(firstSellerId)
  }

  return firstSellerId
}

const resolveSellerHeaders = async (enabled?: boolean) => {
  if (!enabled) {
    return {}
  }

  const sellerId = readStoredSellerId() || (await fetchFirstSellerId())

  return sellerId ? { [SELLER_ID_HEADER]: sellerId } : {}
}

export const fetchQuery = async (
  url: string,
  {
    method,
    body,
    query,
    headers,
    sellerScoped,
    signal,
  }: {
    method: 'GET' | 'POST' | 'DELETE'
    body?: object
    query?: Record<string, string | number | object>
    headers?: { [key: string]: string }
    sellerScoped?: boolean
    signal?: AbortSignal
  }
) => {
  const params = Object.entries(query || {}).reduce((acc, [key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      if (Array.isArray(value)) {
        const arrayParams = value
          .map(
            (item) =>
              `${encodeURIComponent(key)}[]=${encodeURIComponent(item)}`
          )
          .join('&')
        if (acc) {
          acc += '&' + arrayParams
        } else {
          acc = arrayParams
        }
      } else {
        const separator = acc ? '&' : ''
        const serializedValue =
          typeof value === 'object' ? JSON.stringify(value) : value
        acc += `${separator}${encodeURIComponent(key)}=${encodeURIComponent(serializedValue)}`
      }
    }
    return acc
  }, '')

  const response = await fetch(
    `${backendUrl}${url}${params ? `?${params}` : ''}`,
    {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(await resolveSellerHeaders(sellerScoped)),
        ...headers,
      },
      body: body ? JSON.stringify(body) : null,
      signal,
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))

    if (response.status === 401) {
      window.location.href = '/seller/login?reason=Unauthorized'
      return
    }

    const error = new Error(errorData.error || errorData.message || 'Server error')
      ; (error as Error & { status: number; data?: unknown }).status = response.status
      ; (error as Error & { status: number; data?: unknown }).data = errorData
    throw error
  }

  return response.json()
}

export const uploadFilesQuery = async (files: any[]) => {
  const formData = new FormData()

  for (const { file } of files) {
    formData.append('files', file)
  }

  const response = await fetch(`${backendUrl}/vendor/uploads`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })

  if (!response.ok) {
    return null
  }

  return response.json()
}

export const uploadDijieRolePackageQuery = async (files: any[]) => {
  return fetchQuery('/vendor/dijie/role-packages', {
    method: 'POST',
    body: { files },
    sellerScoped: true,
  })
}

export type DijieVendorRoleCategoryOption = {
  categoryRef: string
  name: string
  version: string
  description?: string
  packBinding?: {
    categoryPackRef: string
    skillPackRef: string
    toolPackRef: string
    inheritedCatalogRefCount: number
    inheritedCapabilityRefCount: number
  } | null
}

export const fetchDijieRoleCategoriesQuery = async () => {
  return fetchQuery('/vendor/dijie/role-categories', {
    method: 'GET',
    sellerScoped: true,
  }) as Promise<{ ok: boolean; categories?: DijieVendorRoleCategoryOption[] }>
}

export const generateDijieRolePackageDraftQuery = async (
  message: string,
  options?: {
    categoryRef?: string
    draftId?: string
    maxStages?: number
    stageTimeoutMs?: number
    startNew?: boolean
    signal?: AbortSignal
  }
) => {
  return fetchQuery('/vendor/dijie/role-packages/generate', {
    method: 'POST',
    body: {
      message,
      ...(options?.categoryRef ? { categoryRef: options.categoryRef } : {}),
      ...(options?.draftId ? { draftId: options.draftId } : {}),
      ...(options?.maxStages ? { maxStages: options.maxStages } : {}),
      ...(options?.stageTimeoutMs ? { stageTimeoutMs: options.stageTimeoutMs } : {}),
      ...(options?.startNew ? { startNew: true } : {}),
    },
    sellerScoped: true,
    signal: options?.signal,
  })
}

export const requestDijieSpecialCapabilityPackQuery = async (payload: {
  need: string
  kind?: string
  reason?: string
  categoryRef: string
  rolePackageId?: string | null
  roleListingId?: string | null
  businessScenario?: string | null
  expectedInput?: string | null
  expectedOutput?: string | null
  reviewBoundary?: string | null
}) => {
  return fetchQuery('/vendor/dijie/special-capability-requests', {
    method: 'POST',
    body: payload,
    sellerScoped: true,
  })
}

export const sendDijieDeveloperDialogMessageQuery = async (message: string, signal?: AbortSignal) => {
  return fetchQuery('/dijie/dialog/messages', {
    method: 'POST',
    body: {
      surface: 'developer_center',
      message,
    },
    signal,
  })
}

export type DijieDialogSurface =
  | 'buyer_storefront'
  | 'user_center'
  | 'developer_center'
  | 'admin_review'

export type DijieDialogStreamHandlers = {
  onStatus?: (data: Record<string, unknown>) => void
  onFallback?: (data: Record<string, unknown>) => void
  onDelta?: (data: Record<string, unknown>) => void
  onMetrics?: (data: Record<string, unknown>) => void
  onFinal?: (data: Record<string, unknown>) => void
  onError?: (data: Record<string, unknown>) => void
}

export type DijieDialogStreamRequest = {
  surface: DijieDialogSurface
  message: string
  sessionId?: string
  subject?: Record<string, unknown>
}

const parseDijieStreamData = (text: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : { value: parsed }
  } catch {
    return { message: text }
  }
}

export const streamDijieDialogMessageQuery = async (
  input: DijieDialogStreamRequest,
  handlers: DijieDialogStreamHandlers = {},
  signal?: AbortSignal
) => {
  const response = await fetch(`${backendUrl}/dijie/dialog/messages/stream`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      surface: input.surface,
      message: input.message,
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      ...(input.subject ? { subject: input.subject } : {}),
    }),
    signal,
  })

  if (!response.ok || !response.body) {
    const errorData = await response.json().catch(() => ({}))

    if (response.status === 401) {
      window.location.href = '/seller/login?reason=Unauthorized'
      return undefined
    }

    const error = new Error(
      (errorData as { error?: string; message?: string }).error ||
        (errorData as { error?: string; message?: string }).message ||
        'Dialog stream unavailable'
    )
    ;(error as Error & { status: number; data?: unknown }).status = response.status
    ;(error as Error & { status: number; data?: unknown }).data = errorData
    throw error
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalData: Record<string, unknown> | undefined
  let errorData: Record<string, unknown> | undefined

  const handleEventBlock = (block: string) => {
    const lines = block.split(/\r?\n/)
    let eventName = 'message'
    const dataLines: string[] = []

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice('event:'.length).trim()
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trimStart())
      }
    }

    if (dataLines.length === 0) {
      return
    }

    const data = parseDijieStreamData(dataLines.join('\n'))

    if (eventName === 'status') {
      handlers.onStatus?.(data)
    } else if (eventName === 'fallback') {
      handlers.onFallback?.(data)
    } else if (eventName === 'delta') {
      handlers.onDelta?.(data)
    } else if (eventName === 'metrics') {
      handlers.onMetrics?.(data)
    } else if (eventName === 'final') {
      finalData = data
      handlers.onFinal?.(data)
    } else if (eventName === 'error') {
      errorData = data
      handlers.onError?.(data)
    }
  }

  while (true) {
    // eslint-disable-next-line no-await-in-loop -- SSE chunks must be read in order.
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const blocks = buffer.split(/\r?\n\r?\n/)
    buffer = blocks.pop() ?? ''
    blocks.forEach(handleEventBlock)

    if (done) {
      break
    }
  }

  if (buffer.trim()) {
    handleEventBlock(buffer)
  }

  if (finalData) {
    return finalData
  }

  if (errorData) {
    const error = new Error(
      typeof errorData.error === 'string'
        ? errorData.error
        : typeof errorData.message === 'string'
          ? errorData.message
          : 'Dialog stream failed'
    )
    ;(error as Error & { data?: unknown }).data = errorData
    throw error
  }

  throw new Error('Dialog stream ended before a final response.')
}

export const streamDijieDeveloperDialogMessageQuery = async (
  message: string,
  handlers: DijieDialogStreamHandlers = {},
  signal?: AbortSignal
) => {
  return streamDijieDialogMessageQuery(
    {
      surface: 'developer_center',
      message,
    },
    handlers,
    signal
  )
}

export const fetchLatestDijieRolePackageDraftQuery = async () => {
  return fetchQuery('/vendor/dijie/role-packages/drafts/latest', {
    method: 'GET',
    sellerScoped: true,
  })
}

export const submitDijieRolePackageDraftQuery = async (draftId: string) => {
  return fetchQuery(`/vendor/dijie/role-packages/drafts/${encodeURIComponent(draftId)}/submit`, {
    method: 'POST',
    sellerScoped: true,
  })
}

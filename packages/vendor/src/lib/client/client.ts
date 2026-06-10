import { createClient, InferClient } from '@mercurjs/client'
import { Routes } from '@mercurjs/core/_generated'
import config from 'virtual:mercur/config'

const resolveBackendUrl = () => {
  const configured = config.backendUrl
  const browserOrigin =
    typeof window !== 'undefined' ? window.location.origin : undefined

  if (!configured) {
    if (browserOrigin) {
      try {
        const originUrl = new URL(browserOrigin)
        if (['7001', '5173'].includes(originUrl.port)) {
          originUrl.port = '9000'
          return originUrl.origin
        }
      } catch {
        // Fall through to the static local backend default.
      }
      return browserOrigin
    }

    return 'http://localhost:9000'
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
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
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

export const generateDijieRolePackageDraftQuery = async (
  message: string,
  options?: {
    draftId?: string
    maxStages?: number
    startNew?: boolean
    signal?: AbortSignal
  }
) => {
  return fetchQuery('/vendor/dijie/role-packages/generate', {
    method: 'POST',
    body: {
      message,
      ...(options?.draftId ? { draftId: options.draftId } : {}),
      ...(options?.maxStages ? { maxStages: options.maxStages } : {}),
      ...(options?.startNew ? { startNew: true } : {}),
    },
    sellerScoped: true,
    signal: options?.signal,
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

export const fetchLatestDijieRolePackageDraftQuery = async () => {
  return fetchQuery('/vendor/dijie/role-packages/drafts/latest', {
    method: 'GET',
    sellerScoped: true,
  })
}

export const fetchDijieRolePackageDraftQuery = async (draftId: string) => {
  return fetchQuery(`/vendor/dijie/role-packages/drafts/${encodeURIComponent(draftId)}`, {
    method: 'GET',
    sellerScoped: true,
  })
}

export const updateDijieRolePackageDraftFileQuery = async (
  draftId: string,
  path: string,
  content: string
) => {
  return fetchQuery(`/vendor/dijie/role-packages/drafts/${encodeURIComponent(draftId)}/files`, {
    method: 'PATCH',
    body: { path, content },
    sellerScoped: true,
  })
}

export const confirmDijieRolePackageDraftFileQuery = async (
  draftId: string,
  path: string
) => {
  return fetchQuery(
    `/vendor/dijie/role-packages/drafts/${encodeURIComponent(draftId)}/files/confirm`,
    {
      method: 'POST',
      body: { path },
      sellerScoped: true,
    }
  )
}

export const submitDijieRolePackageDraftQuery = async (draftId: string) => {
  return fetchQuery(`/vendor/dijie/role-packages/drafts/${encodeURIComponent(draftId)}/submit`, {
    method: 'POST',
    sellerScoped: true,
  })
}

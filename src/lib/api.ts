export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function handleResponse(response: Response): Promise<Response> {
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText)
    throw new ApiError(response.status, text)
  }
  return response
}

export async function apiGet(path: string): Promise<Response> {
  const response = await fetch(path, { credentials: 'same-origin' })
  return handleResponse(response)
}

export async function apiGetJson<T>(path: string): Promise<T> {
  const response = await apiGet(path)
  return response.json() as Promise<T>
}

export async function apiPut(path: string, body: FormData): Promise<Response> {
  const response = await fetch(path, {
    method: 'PUT',
    body,
    credentials: 'same-origin',
  })
  return handleResponse(response)
}

export async function apiDelete(path: string): Promise<Response> {
  const response = await fetch(path, {
    method: 'DELETE',
    credentials: 'same-origin',
  })
  return handleResponse(response)
}

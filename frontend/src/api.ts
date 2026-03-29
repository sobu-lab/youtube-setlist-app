import { SetlistResponse } from './types'

export async function fetchSetlist(url: string): Promise<SetlistResponse> {
  const res = await fetch(`/api/setlist?url=${encodeURIComponent(url)}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(err.detail || 'セットリストの取得に失敗しました')
  }
  return res.json()
}

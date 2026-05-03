import { SetlistResponse } from './types'

export async function fetchSetlist(url: string, provider: string): Promise<SetlistResponse> {
  const res = await fetch(`/api/setlist?url=${encodeURIComponent(url)}&provider=${provider}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(err.detail || 'セットリストの取得に失敗しました')
  }
  return res.json()
}

export type AudioUrlResponse = {
  audio_url: string
  title: string
  duration: number
}

export async function fetchAudioUrl(videoId: string): Promise<AudioUrlResponse> {
  const res = await fetch(`/api/audio-url?video_id=${encodeURIComponent(videoId)}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(err.detail || '音声URLの取得に失敗しました')
  }
  return res.json()
}

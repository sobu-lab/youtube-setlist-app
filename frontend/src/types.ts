export interface SetlistItem {
  index: number
  timestamp: string
  timestamp_seconds: number
  song_title: string
  artist: string | null
}

export interface SetlistResponse {
  video_id: string
  title: string
  channel: string
  thumbnail: string
  published_at: string
  view_count: number
  setlist_found: boolean
  setlist_source: 'description' | 'comments' | null
  setlist: SetlistItem[]
}

import { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react'
import { fetchAudioUrl } from '../api'

export type BackgroundPlayerHandle = {
  seekTo: (seconds: number) => void
}

interface Props {
  videoId: string
}

const BackgroundPlayer = forwardRef<BackgroundPlayerHandle, Props>(({ videoId }, ref) => {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState<string | null>(null)
  const [active, setActive] = useState(false)
  const [playing, setPlaying] = useState(false)

  useImperativeHandle(ref, () => ({
    seekTo(seconds: number) {
      if (audioRef.current && active) {
        audioRef.current.currentTime = seconds
        audioRef.current.play().catch(() => {})
        setPlaying(true)
      }
    },
  }))

  // 別の動画に切り替わったら停止してリセット
  useEffect(() => {
    setActive(false)
    setPlaying(false)
    setTitle(null)
    setError(null)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
  }, [videoId])

  const handleStart = async () => {
    if (!audioRef.current) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAudioUrl(videoId)
      audioRef.current.src = data.audio_url
      audioRef.current.load()
      await audioRef.current.play()
      setTitle(data.title)
      setActive(true)
      setPlaying(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '音声の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const togglePlay = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play().catch(() => {})
      setPlaying(true)
    }
  }

  return (
    <div className="mt-3 rounded-xl bg-gray-900 border border-gray-700 p-3">
      <audio
        ref={audioRef}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />

      {!active ? (
        <button
          onClick={handleStart}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors w-full justify-center"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              音声URL取得中...
            </>
          ) : (
            <>🎵 バックグラウンド再生</>
          )}
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-purple-700 hover:bg-purple-600 transition-colors"
            aria-label={playing ? '一時停止' : '再生'}
          >
            {playing ? '⏸' : '▶️'}
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-purple-400 font-medium truncate">バックグラウンド再生中</p>
            {title && <p className="text-sm text-gray-200 truncate">{title}</p>}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  )
})

BackgroundPlayer.displayName = 'BackgroundPlayer'

export default BackgroundPlayer

import { useState, useRef, useEffect } from 'react'
import SearchBar from './components/SearchBar'
import VideoInfo from './components/VideoInfo'
import SetlistPanel from './components/SetlistPanel'
import YouTubePlayer from './components/YouTubePlayer'
import { fetchSetlist } from './api'
import { SetlistResponse } from './types'

type PlayerRef = {
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void
  playVideo: () => void
} | null

export default function App() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<SetlistResponse | null>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [provider, setProvider] = useState<string>('gemini')
  const [availableProviders, setAvailableProviders] = useState<string[]>([])
  const playerRef = useRef<PlayerRef>(null)

  useEffect(() => {
    fetch('/api/info')
      .then((r) => r.json())
      .then((d) => {
        setProvider(d.ai_provider)
        setAvailableProviders(d.available_providers ?? [])
      })
      .catch(() => {})
  }, [])

  const handleSearch = async (url: string) => {
    setLoading(true)
    setError(null)
    setData(null)
    setActiveIndex(null)
    try {
      const result = await fetchSetlist(url, provider)
      setData(result)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '不明なエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleSeek = (seconds: number, index: number) => {
    setActiveIndex(index)
    if (playerRef.current) {
      playerRef.current.seekTo(seconds, true)
      playerRef.current.playVideo()
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* ヘッダー */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <span className="text-2xl">🎵</span>
          <h1 className="text-xl font-bold text-purple-400">歌枠セットリスト</h1>
          {/* AIプロバイダー切り替え */}
          {availableProviders.length > 0 && (
            <div className="ml-3 flex items-center gap-1 bg-gray-800 rounded-full p-1">
              {availableProviders.map((p) => (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    provider === p
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {p === 'openai' ? 'OpenAI' : 'Gemini'}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* 検索バー */}
        <SearchBar onSearch={handleSearch} loading={loading} />

        {/* エラー表示 */}
        {error && (
          <div className="mt-4 p-4 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* ローディング */}
        {loading && (
          <div className="mt-12 flex flex-col items-center gap-4 text-gray-400">
            <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p>{provider === 'openai' ? 'OpenAI' : 'Gemini'} がセットリストを解析中...</p>
            <p className="text-xs text-gray-600">概要欄・コメント欄を確認しています</p>
          </div>
        )}

        {/* 結果表示 */}
        {data && (
          <div className="mt-6 space-y-6">
            <VideoInfo data={data} />
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* プレイヤー (左3/5) */}
              <div className="lg:col-span-3">
                <YouTubePlayer videoId={data.video_id} playerRef={playerRef} />
              </div>
              {/* セットリスト (右2/5) */}
              <div className="lg:col-span-2">
                <SetlistPanel
                  setlist={data.setlist}
                  setlistFound={data.setlist_found}
                  setlistSource={data.setlist_source}
                  activeIndex={activeIndex}
                  onSeek={handleSeek}
                />
              </div>
            </div>
          </div>
        )}

        {/* 初期状態のヒント */}
        {!loading && !data && !error && (
          <div className="mt-16 text-center text-gray-600">
            <p className="text-4xl mb-4">🎤</p>
            <p>歌枠・歌ってみた動画のURLを入力してください</p>
            <p className="text-sm mt-2">概要欄またはコメント欄からセットリストを自動抽出します</p>
          </div>
        )}
      </main>
    </div>
  )
}

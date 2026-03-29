import { SetlistItem } from '../types'

interface Props {
  setlist: SetlistItem[]
  setlistFound: boolean
  setlistSource: string | null
  activeIndex: number | null
  onSeek: (seconds: number, index: number) => void
}

export default function SetlistPanel({
  setlist,
  setlistFound,
  setlistSource,
  activeIndex,
  onSeek,
}: Props) {
  if (!setlistFound || setlist.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center h-full flex flex-col items-center justify-center gap-2">
        <span className="text-3xl">😔</span>
        <p className="text-gray-400 text-sm font-medium">セットリストが見つかりませんでした</p>
        <p className="text-gray-600 text-xs">概要欄・コメント欄に記載がない可能性があります</p>
      </div>
    )
  }

  const sourceLabel = setlistSource === 'description' ? '概要欄' : 'コメント'

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden flex flex-col">
      {/* ヘッダー */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
        <h3 className="font-semibold text-gray-100 text-sm">セットリスト</h3>
        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full">
          {setlist.length}曲 · {sourceLabel}から取得
        </span>
      </div>

      {/* 曲リスト */}
      <div className="overflow-y-auto" style={{ maxHeight: '460px' }}>
        {setlist.map((item) => {
          const isActive = activeIndex === item.index
          return (
            <button
              key={item.index}
              onClick={() => onSeek(item.timestamp_seconds, item.index)}
              className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-gray-800/50 last:border-0 ${
                isActive
                  ? 'bg-purple-900/30 border-l-2 border-l-purple-500'
                  : 'hover:bg-gray-800/60'
              }`}
            >
              {/* 番号 */}
              <span className="text-xs text-gray-600 w-5 flex-shrink-0 mt-0.5 text-right">
                {item.index}
              </span>
              {/* タイムスタンプ */}
              <span className="text-xs text-purple-400 font-mono mt-0.5 w-14 flex-shrink-0">
                {item.timestamp}
              </span>
              {/* 曲名 & アーティスト */}
              <div className="min-w-0">
                <p
                  className={`text-sm font-medium truncate ${
                    isActive ? 'text-purple-300' : 'text-gray-200'
                  }`}
                >
                  {item.song_title}
                </p>
                {item.artist && (
                  <p className="text-xs text-gray-500 truncate mt-0.5">{item.artist}</p>
                )}
              </div>
              {/* 再生中インジケーター */}
              {isActive && (
                <span className="ml-auto flex-shrink-0 text-purple-400 text-xs mt-0.5">▶</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

import { SetlistResponse } from '../types'

interface Props {
  data: SetlistResponse
}

export default function VideoInfo({ data }: Props) {
  return (
    <div className="flex gap-4 items-start p-4 bg-gray-900 rounded-xl border border-gray-800">
      <img
        src={data.thumbnail}
        alt={data.title}
        className="w-36 h-auto rounded-lg object-cover flex-shrink-0"
        onError={(e) => {
          e.currentTarget.src = `https://img.youtube.com/vi/${data.video_id}/hqdefault.jpg`
        }}
      />
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold text-gray-100 leading-snug line-clamp-2">
          {data.title}
        </h2>
        <a
          href={`https://www.youtube.com/channel/${data.video_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-purple-400 hover:text-purple-300 mt-1 inline-block"
        >
          {data.channel}
        </a>
        <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
          <span>{data.published_at}</span>
          <span>{data.view_count.toLocaleString()} 回視聴</span>
        </div>
      </div>
    </div>
  )
}

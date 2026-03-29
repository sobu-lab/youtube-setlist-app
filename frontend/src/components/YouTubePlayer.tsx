import YouTube, { YouTubeProps } from 'react-youtube'
import { RefObject } from 'react'

type PlayerHandle = {
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void
  playVideo: () => void
}

interface Props {
  videoId: string
  playerRef: RefObject<PlayerHandle | null>
}

export default function YouTubePlayer({ videoId, playerRef }: Props) {
  const onReady: YouTubeProps['onReady'] = (event) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(playerRef as React.MutableRefObject<PlayerHandle | null>).current = event.target as any
  }

  return (
    <div className="w-full aspect-video rounded-xl overflow-hidden bg-black">
      <YouTube
        videoId={videoId}
        opts={{
          width: '100%',
          height: '100%',
          playerVars: { autoplay: 0 },
        }}
        className="yt-player w-full h-full"
        onReady={onReady}
      />
    </div>
  )
}

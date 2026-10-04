'use client'

import { useEffect, useRef, useState } from 'react'

export const HERO_VIDEO = '/video/tellero-hero.mp4'
export const HERO_POSTER = '/video/tellero-hero-poster.jpg'

/** Muted looping hero film. Pauses offscreen / in hidden tabs; never autoplays under reduced motion. */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const userPaused = useRef(false)

  useEffect(() => {
    const video = ref.current
    if (!video) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) userPaused.current = true

    const tryPlay = () => {
      if (userPaused.current || document.hidden) return
      video.play().catch(() => setPlaying(false))
    }
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? tryPlay() : video.pause()), { threshold: 0.25 })
    io.observe(video)
    const onVis = () => (document.hidden ? video.pause() : tryPlay())
    document.addEventListener('visibilitychange', onVis)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  const toggle = () => {
    const video = ref.current
    if (!video) return
    if (video.paused) {
      userPaused.current = false
      video.play()
    } else {
      userPaused.current = true
      video.pause()
    }
  }

  return (
    <div className="hero-frame relative overflow-hidden rounded-[28px] bg-ink shadow-[0_30px_80px_-30px_rgb(11_18_32/0.55)] ring-1 ring-ink/10">
      <video
        ref={ref}
        className="block aspect-video w-full object-cover"
        src={HERO_VIDEO}
        poster={HERO_POSTER}
        muted
        loop
        playsInline
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        aria-label="A 30-second film: Tellero AI calls a Lagos customer, fixes a vague address with a landmark, and confirms the delivery."
      />
      <button
        onClick={toggle}
        aria-label={playing ? 'Pause film' : 'Play film'}
        className="btn absolute bottom-4 left-4 flex h-11 items-center gap-2 rounded-full bg-white/90 px-4 text-sm font-semibold text-ink shadow-lg backdrop-blur"
      >
        {playing ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
            <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
          </svg>
        )}
        {playing ? 'Pause' : 'Play the 30-second film'}
      </button>
    </div>
  )
}

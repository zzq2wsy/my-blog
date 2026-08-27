import { onBeforeUnmount, onMounted } from 'vue'
import { withBase } from 'vuepress/client'

const interactionEvents = ['click', 'touchstart', 'keydown'] as const
const backgroundMusicVolume = 0.2

export function useBackgroundMusic(): void {
  let audio: HTMLAudioElement | null = null
  let isDisposed = false
  let isPageActive = true

  const removeInteractionListeners = (): void => {
    interactionEvents.forEach(event => {
      document.removeEventListener(event, playAfterInteraction)
    })
  }

  const addInteractionListeners = (): void => {
    if (isDisposed || !isPageActive)
      return

    interactionEvents.forEach(event => {
      document.addEventListener(event, playAfterInteraction, { passive: true })
    })
  }

  const playAfterInteraction = (): void => {
    if (!audio)
      return

    void audio.play().then(removeInteractionListeners).catch(() => {
      // Keep listening until the browser accepts playback.
    })
  }

  const restartPlayback = (): void => {
    if (!audio || isDisposed)
      return

    isPageActive = true
    audio.currentTime = 0
    void audio.play().then(removeInteractionListeners).catch(addInteractionListeners)
  }

  const stopPlayback = (): void => {
    isPageActive = false
    removeInteractionListeners()
    audio?.pause()
  }

  onMounted(() => {
    audio = new Audio(withBase('/audio/project.mp3'))
    audio.loop = true
    audio.preload = 'auto'
    audio.volume = backgroundMusicVolume
    audio.hidden = true
    audio.dataset.backgroundMusic = ''
    document.body.append(audio)

    window.addEventListener('pagehide', stopPlayback)
    window.addEventListener('beforeunload', stopPlayback)
    window.addEventListener('pageshow', restartPlayback)
    restartPlayback()
  })

  onBeforeUnmount(() => {
    isDisposed = true
    window.removeEventListener('pagehide', stopPlayback)
    window.removeEventListener('beforeunload', stopPlayback)
    window.removeEventListener('pageshow', restartPlayback)
    stopPlayback()
    if (audio) {
      audio.remove()
      audio.src = ''
      audio = null
    }
  })
}

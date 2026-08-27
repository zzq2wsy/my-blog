<script setup lang="ts">
import type { ThemeHomeHero, ThemeHomeHeroLightning } from 'vuepress-theme-plume'
import Lightning from '@theme/background/Lightning.vue'
import { VPHomeHero } from 'vuepress-theme-plume/client'
import { computed, onMounted, onUnmounted, ref } from 'vue'

interface Profile {
  name: string
  avatar: string
  role: string
  motto: string
  wechat: string
}

const props = defineProps<ThemeHomeHero & {
  index?: number
  onlyOnce?: boolean
  profile: Profile
}>()

const now = ref<Date | null>(null)
const impactVisible = ref(false)
const impactCycle = ref(0)
const impactStyle = ref<Record<string, string>>({})
const impactFragments = [
  { x1: '-10px', y1: '-13px', xm: '-32px', ym: '-35px', x2: '-54px', y2: '-45px', size: '4px', color: '#7be7ff', rotate: '-150deg', delay: '0ms' },
  { x1: '5px', y1: '-17px', xm: '17px', ym: '-45px', x2: '24px', y2: '-68px', size: '3px', color: '#d7b8ff', rotate: '210deg', delay: '35ms' },
  { x1: '14px', y1: '-8px', xm: '40px', ym: '-23px', x2: '62px', y2: '-31px', size: '5px', color: '#ff8bd1', rotate: '145deg', delay: '15ms' },
  { x1: '16px', y1: '5px', xm: '44px', ym: '13px', x2: '70px', y2: '28px', size: '3px', color: '#ffe082', rotate: '240deg', delay: '55ms' },
  { x1: '7px', y1: '15px', xm: '22px', ym: '39px', x2: '30px', y2: '66px', size: '4px', color: '#82f0d0', rotate: '-190deg', delay: '25ms' },
  { x1: '-7px', y1: '17px', xm: '-20px', ym: '43px', x2: '-29px', y2: '72px', size: '3px', color: '#a7c7ff', rotate: '170deg', delay: '65ms' },
  { x1: '-16px', y1: '8px', xm: '-43px', ym: '18px', x2: '-67px', y2: '34px', size: '5px', color: '#d7b8ff', rotate: '-230deg', delay: '20ms' },
  { x1: '-17px', y1: '-2px', xm: '-46px', ym: '-10px', x2: '-74px', y2: '-12px', size: '3px', color: '#ff9fcb', rotate: '200deg', delay: '50ms' },
  { x1: '2px', y1: '-12px', xm: '7px', ym: '-34px', x2: '7px', y2: '-57px', size: '2px', color: '#ffffff', rotate: '-120deg', delay: '80ms' },
  { x1: '11px', y1: '11px', xm: '34px', ym: '28px', x2: '52px', y2: '53px', size: '2px', color: '#7be7ff', rotate: '260deg', delay: '75ms' },
]
let timer: ReturnType<typeof setInterval> | undefined

const date = computed(() => now.value?.toLocaleDateString('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
}) ?? '正在获取日期')

const time = computed(() => now.value?.toLocaleTimeString('zh-CN', {
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
}) ?? '--:--:--')

const lightningConfig = computed(() => (props.effectConfig ?? {}) as ThemeHomeHeroLightning)

function showImpact() {
  const angle = Math.random() * Math.PI * 2
  const isMobile = window.matchMedia('(max-width: 900px)').matches
  const radius = isMobile
    ? 62 + Math.random() * 14
    : 92 + Math.random() * 24
  const rotationRange = isMobile ? 24 : 35
  const rotation = Math.round(Math.random() * rotationRange * 2 - rotationRange)

  impactStyle.value = {
    '--impact-x': `${Math.cos(angle) * radius}px`,
    '--impact-y': `${Math.sin(angle) * radius}px`,
    '--impact-start-x': `${Math.cos(angle) * radius * 0.25}px`,
    '--impact-start-y': `${Math.sin(angle) * radius * 0.25}px`,
    '--impact-rotate': `${rotation}deg`,
  }
  impactCycle.value += 1
  impactVisible.value = true
}

function hideImpact() {
  impactVisible.value = false
}

onMounted(() => {
  now.value = new Date()
  timer = setInterval(() => {
    now.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  if (timer)
    clearInterval(timer)
})
</script>

<template>
  <div class="home-hero-profile">
    <Lightning
      v-if="props.effect === 'lightning'"
      class="profile-lightning"
      v-bind="lightningConfig"
    />
    <VPHomeHero v-bind="props" :effect="undefined" />

    <aside class="profile-panel" aria-label="个人信息">
      <div
        class="avatar-stage"
        tabindex="0"
        aria-label="头像，悬停显示猛字效果"
        @pointerenter="showImpact"
        @pointerleave="hideImpact"
        @click="showImpact"
        @focus="showImpact"
        @blur="hideImpact"
        @keydown.enter.prevent="showImpact"
        @keydown.space.prevent="showImpact"
      >
        <img class="profile-avatar" :src="profile.avatar" :alt="`${profile.name} 的头像`">
        <span
          :key="impactCycle"
          class="avatar-impact"
          :class="{ 'is-visible': impactVisible }"
          :style="impactStyle"
          aria-hidden="true"
        >
          <span class="impact-half impact-half-left">猛</span>
          <span class="impact-half impact-half-right">猛</span>
          <span class="impact-rift" />
          <span
            v-for="(fragment, index) in impactFragments"
            :key="index"
            class="impact-fragment"
            :style="{
              '--fragment-x1': fragment.x1,
              '--fragment-y1': fragment.y1,
              '--fragment-xm': fragment.xm,
              '--fragment-ym': fragment.ym,
              '--fragment-x2': fragment.x2,
              '--fragment-y2': fragment.y2,
              '--fragment-size': fragment.size,
              '--fragment-color': fragment.color,
              '--fragment-rotate': fragment.rotate,
              '--fragment-delay': fragment.delay,
            }"
          />
        </span>
      </div>

      <div class="profile-clock" aria-live="off">
        <span class="profile-date">{{ date }}</span>
        <strong class="profile-time">{{ time }}</strong>
      </div>

      <div class="profile-copy">
        <h2>{{ profile.name }}</h2>
        <p>{{ profile.role }}</p>
        <p>{{ profile.motto }}</p>
      </div>

      <div class="profile-contact">
        <span>微信 {{ profile.wechat }}</span>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.home-hero-profile {
  position: relative;
}

.profile-lightning {
  z-index: 0;
  pointer-events: none;
  mix-blend-mode: screen;
}

.home-hero-profile :deep(.vp-home-hero) {
  z-index: 1;
}

.profile-panel {
  position: absolute;
  z-index: 2;
  top: 50%;
  left: max(36px, calc((100vw - 1380px) / 2));
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 280px;
  color: rgba(255, 255, 255, 0.9);
  text-align: center;
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.72);
  transform: translateY(-46%);
}

.avatar-stage {
  position: relative;
  display: grid;
  place-items: center;
  width: 144px;
  height: 144px;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.profile-avatar {
  width: 132px;
  height: 132px;
  object-fit: cover;
  border: 2px solid rgba(139, 214, 235, 0.82);
  border-radius: 50%;
  box-shadow:
    0 0 0 6px rgba(12, 22, 32, 0.34),
    0 0 28px rgba(109, 202, 230, 0.42);
  animation: avatar-spin 16s linear infinite;
}

.avatar-stage:hover .profile-avatar,
.avatar-stage:focus-visible .profile-avatar {
  animation-play-state: paused;
}

.avatar-impact {
  --impact-left-x: -38px;
  --impact-left-y: 22px;
  --impact-right-x: 42px;
  --impact-right-y: -25px;

  position: absolute;
  z-index: 3;
  top: 50%;
  left: 50%;
  width: 64px;
  height: 64px;
  font-family: STKaiti, KaiTi, serif;
  font-size: 52px;
  font-weight: 900;
  line-height: 1;
  pointer-events: none;
  opacity: 0;
  filter:
    drop-shadow(0 0 4px rgba(123, 231, 255, 0.9))
    drop-shadow(0 0 11px rgba(184, 128, 255, 0.68));
  transform:
    translate(-50%, -50%)
    translate(var(--impact-start-x, 0px), var(--impact-start-y, -20px))
    rotate(var(--impact-rotate, 0deg))
    scale(0.2);
}

.avatar-stage:hover .avatar-impact,
.avatar-stage:focus-visible .avatar-impact,
.avatar-impact.is-visible {
  animation: impact-arrive 1500ms cubic-bezier(0.16, 1.18, 0.3, 1) forwards;
}

.impact-half {
  position: absolute;
  inset: 0;
  color: transparent;
  background: linear-gradient(135deg, #74e8ff 2%, #b8a5ff 38%, #ff82cf 68%, #ffe38a 98%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-stroke: 0.7px rgba(255, 255, 255, 0.72);
}

.impact-half-left {
  clip-path: polygon(0 0, 64% 0, 43% 100%, 0 100%);
}

.impact-half-right {
  clip-path: polygon(62% 0, 100% 0, 100% 100%, 41% 100%);
}

.avatar-impact.is-visible .impact-half-left {
  animation: impact-split-left 1500ms ease-in forwards;
}

.avatar-impact.is-visible .impact-half-right {
  animation: impact-split-right 1500ms ease-in forwards;
}

.impact-rift {
  position: absolute;
  top: -7px;
  left: 31px;
  width: 5px;
  height: 76px;
  background: #fff;
  border-radius: 50%;
  opacity: 0;
  box-shadow:
    0 0 8px #fff,
    0 0 18px #7be7ff,
    0 0 34px #aa7dff;
  transform: rotate(13deg) scaleY(0);
  transform-origin: center;
}

.avatar-impact.is-visible .impact-rift {
  animation: impact-rift 1500ms ease-out forwards;
}

.impact-fragment {
  position: absolute;
  top: 31px;
  left: 31px;
  width: var(--fragment-size);
  height: var(--fragment-size);
  color: var(--fragment-color);
  background: currentColor;
  border-radius: 50%;
  opacity: 0;
  box-shadow: 0 0 8px currentColor;
}

.avatar-impact.is-visible .impact-fragment {
  animation: impact-fragment 1500ms ease-out var(--fragment-delay) forwards;
}

@keyframes impact-arrive {
  0% {
    opacity: 0;
    transform:
      translate(-50%, -50%)
      translate(var(--impact-start-x), var(--impact-start-y))
      rotate(var(--impact-rotate))
      scale(0.2);
  }

  22%,
  78% {
    opacity: 1;
    transform:
      translate(-50%, -50%)
      translate(var(--impact-x), var(--impact-y))
      rotate(var(--impact-rotate))
      scale(1.08);
  }

  100% {
    opacity: 0;
    transform:
      translate(-50%, -50%)
      translate(var(--impact-x), var(--impact-y))
      rotate(var(--impact-rotate))
      scale(0.94);
  }
}

@keyframes impact-split-left {
  0%,
  45% {
    opacity: 1;
    transform: translate(0, 0) rotate(0);
  }

  58% {
    transform: translate(-6px, -2px) rotate(-4deg);
  }

  100% {
    opacity: 0;
    filter: blur(2px);
    transform:
      translate(var(--impact-left-x), var(--impact-left-y))
      rotate(-22deg)
      scale(0.72);
  }
}

@keyframes impact-split-right {
  0%,
  45% {
    opacity: 1;
    transform: translate(0, 0) rotate(0);
  }

  58% {
    transform: translate(7px, 3px) rotate(5deg);
  }

  100% {
    opacity: 0;
    filter: blur(2px);
    transform:
      translate(var(--impact-right-x), var(--impact-right-y))
      rotate(24deg)
      scale(0.72);
  }
}

@keyframes impact-rift {
  0%,
  38% {
    opacity: 0;
    transform: rotate(13deg) scaleY(0);
  }

  48% {
    opacity: 1;
    transform: rotate(13deg) scaleY(1.16);
  }

  66%,
  100% {
    opacity: 0;
    transform: rotate(13deg) scaleY(1.35);
  }
}

@keyframes impact-fragment {
  0%,
  46% {
    opacity: 0;
    transform: translate(0, 0) rotate(0) scale(0.15);
  }

  54% {
    opacity: 1;
    transform:
      translate(var(--fragment-x1), var(--fragment-y1))
      rotate(calc(var(--fragment-rotate) * 0.18))
      scale(1);
  }

  76% {
    opacity: 0.68;
    transform:
      translate(var(--fragment-xm), var(--fragment-ym))
      rotate(90deg)
      scale(0.72);
  }

  100% {
    opacity: 0;
    filter: blur(1.5px);
    transform:
      translate(var(--fragment-x2), var(--fragment-y2))
      rotate(var(--fragment-rotate))
      scale(0.18);
  }
}

.profile-clock {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 18px;
}

.profile-date {
  font-size: 14px;
  color: #8dd9e9;
}

.profile-time {
  font-variant-numeric: tabular-nums;
  font-size: 30px;
  line-height: 1.2;
  color: #e1c6ff;
}

.profile-copy {
  margin-top: 16px;
}

.profile-copy h2 {
  margin: 0 0 8px;
  font-size: 24px;
  letter-spacing: 0;
}

.profile-copy p {
  margin: 4px 0;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.76);
}

.profile-contact {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 16px;
  font-size: 14px;
}

.profile-contact a {
  color: #8dd9e9;
  font-weight: 600;
}

.profile-contact span {
  color: rgba(255, 255, 255, 0.72);
}

.home-hero-profile :deep(.hero-content) {
  transform: translateX(150px);
}

@keyframes avatar-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 900px) {
  .profile-lightning {
    left: -50%;
    width: 200%;
  }

  .profile-panel {
    top: calc(var(--vp-nav-height) + 28px);
    left: 50%;
    width: calc(100% - 32px);
    transform: translateX(-50%);
  }

  .profile-avatar {
    width: 84px;
    height: 84px;
  }

  .avatar-stage {
    width: 96px;
    height: 96px;
  }

  .avatar-impact {
    --impact-left-x: -25px;
    --impact-left-y: 15px;
    --impact-right-x: 28px;
    --impact-right-y: -17px;

    font-size: 42px;
  }

  .profile-clock {
    margin-top: 8px;
  }

  .profile-date {
    font-size: 12px;
  }

  .profile-time {
    font-size: 24px;
  }

  .profile-copy,
  .profile-contact {
    display: none;
  }

  .home-hero-profile :deep(.vp-home-hero.full .hero-container) {
    align-items: flex-end;
    box-sizing: border-box;
  }

  .home-hero-profile :deep(.vp-home-hero.full .hero-container .hero-content) {
    margin: 0 auto 10vh;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .profile-avatar {
    animation: none;
  }
}
</style>

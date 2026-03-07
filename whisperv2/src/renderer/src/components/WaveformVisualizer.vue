<template>
  <canvas ref="canvas" class="waveform-canvas"></canvas>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  analyser: AnalyserNode | null
  isRecording: boolean
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
let animationId: number | null = null

const draw = () => {
  if (!canvas.value || !props.analyser || !props.isRecording) return
  
  const ctx = canvas.value.getContext('2d')
  if (!ctx) return
  
  const width = canvas.value.width
  const height = canvas.value.height
  
  // Clear canvas
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
  ctx.fillRect(0, 0, width, height)
  
  // Get frequency data
  const bufferLength = props.analyser.frequencyBinCount
  const dataArray = new Uint8Array(bufferLength)
  props.analyser.getByteFrequencyData(dataArray)
  
  const barWidth = (width / bufferLength) * 2.5
  let x = 0
  
  for (let i = 0; i < bufferLength; i++) {
    const barHeight = (dataArray[i] / 255) * height
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height)
    gradient.addColorStop(0, '#00d4ff')
    gradient.addColorStop(0.5, '#7c3aed')
    gradient.addColorStop(1, '#ef4444')
    
    ctx.fillStyle = gradient
    ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight)
    
    x += barWidth
  }
  
  animationId = requestAnimationFrame(draw)
}

watch(() => props.isRecording, (newVal) => {
  if (newVal && props.analyser) {
    draw()
  } else if (!newVal && animationId) {
    cancelAnimationFrame(animationId)
    // Clear canvas
    if (canvas.value) {
      const ctx = canvas.value.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)
      }
    }
  }
})

onMounted(() => {
  if (canvas.value) {
    canvas.value.width = canvas.value.offsetWidth
    canvas.value.height = canvas.value.offsetHeight
  }
  
  if (props.isRecording && props.analyser) {
    draw()
  }
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
})
</script>

<style scoped>
.waveform-canvas {
  width: 100%;
  height: 80px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.3);
}
</style>

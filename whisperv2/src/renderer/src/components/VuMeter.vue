<template>
  <div class="vu-meter-container">
    <div class="vu-meter">
      <div 
        class="vu-meter-fill" 
        :style="{ width: `${level}%`, backgroundColor: getColor(level) }"
      ></div>
    </div>
    <div class="vu-meter-labels">
      <span>0</span>
      <span>25</span>
      <span>50</span>
      <span>75</span>
      <span>100</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  level: number
}>()

const getColor = (level: number): string => {
  if (level < 30) return '#22c55e' // Green
  if (level < 60) return '#eab308' // Yellow
  if (level < 80) return '#f97316' // Orange
  return '#ef4444' // Red
}
</script>

<style scoped>
.vu-meter-container {
  width: 100%;
  margin: 10px 0;
}

.vu-meter {
  height: 20px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  overflow: hidden;
  position: relative;
}

.vu-meter-fill {
  height: 100%;
  border-radius: 10px;
  transition: width 0.05s ease-out, background-color 0.2s ease;
  min-width: 2px;
}

.vu-meter-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 5px;
  font-size: 0.75rem;
  color: #666;
}
</style>

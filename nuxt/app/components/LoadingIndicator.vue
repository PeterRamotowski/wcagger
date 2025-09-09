<script setup lang="ts">
interface Props {
  step: string;
}

defineProps<Props>();
</script>

<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 text-center">
    <div class="loading-dots mb-4">
      <div></div>
      <div></div>
      <div></div>
      <div></div>
    </div>
    <h3 class="text-lg font-semibold text-gray-900 mb-2">{{ step }}</h3>
    <p class="text-gray-600">{{ $t('loading_moment') }}</p>
  </div>
</template>

<style scoped>
.loading-dots {
  display: inline-block;
  position: relative;
  width: 80px;
  height: 80px;
}

.loading-dots div {
  position: absolute;
  top: 33px;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: #3b82f6;
  animation-timing-function: cubic-bezier(0, 1, 1, 0);
}

.loading-dots div:nth-child(1) {
  left: 8px;
  animation: loading-dots1 0.6s infinite;
}

.loading-dots div:nth-child(2) {
  left: 8px;
  animation: loading-dots2 0.6s infinite;
}

.loading-dots div:nth-child(3) {
  left: 32px;
  animation: loading-dots2 0.6s infinite;
}

.loading-dots div:nth-child(4) {
  left: 56px;
  animation: loading-dots3 0.6s infinite;
}

@keyframes loading-dots1 {
  0% {
    transform: scale(0);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes loading-dots3 {
  0% {
    transform: scale(1);
  }
  100% {
    transform: scale(0);
  }
}

@keyframes loading-dots2 {
  0% {
    transform: translate(0, 0);
  }
  100% {
    transform: translate(24px, 0);
  }
}
</style>

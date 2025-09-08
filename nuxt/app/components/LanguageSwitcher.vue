<script setup lang="ts">
const { locale, locales } = useI18n();
const switchLocalePath = useSwitchLocalePath() as (locale?: string) => string | undefined;
const currentLocale = computed<string>(() => locale.value as string);
</script>

<template>
  <div class="flex items-center space-x-2">
    <span class="text-sm text-gray-600">{{ $t('language') }}:</span>
    <div class="flex space-x-1">
      <NuxtLink
        v-for="locale in locales"
        :key="locale.code"
        :to="switchLocalePath(locale.code)"
        class="px-3 py-1 text-sm rounded-md transition-colors duration-200"
        :class="locale.code === currentLocale
          ? 'bg-blue-100 text-blue-700 font-medium'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'"
      >
        {{ locale.code }}
      </NuxtLink>
    </div>
  </div>
</template>

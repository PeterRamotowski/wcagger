<script setup lang="ts">
useHead({
  title: 'WCAG Compliance Checker',
  meta: [
    { name: 'description', content: 'Professional WCAG compliance checker using Axe and Pa11y for comprehensive web accessibility auditing.' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { charset: 'utf-8' }
  ],
  link: [
    { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
  ]
})
</script>

<template>
  <div id="__nuxt">
    <NuxtPage />
  </div>
</template>

<style>
html {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  scroll-behavior: smooth;
}
</style>

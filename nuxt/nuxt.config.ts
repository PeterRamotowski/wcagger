import tailwindcss from '@tailwindcss/vite';

export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: [
    '@nuxt/eslint',
    '@nuxtjs/i18n',
    '@nuxt/devtools'
  ],
  css: [
    '~/assets/css/main.css'
  ],
  eslint: {
    config: {
      stylistic: {
        semi: false,
        quotes: 'single',
        indent: 2,
        braceStyle: '1tbs'
      }
    }
  },
  i18n: {
    locales: [
      {
        code: 'pl',
        iso: 'pl-PL',
        name: 'Polski',
        file: 'pl.json'
      },
      {
        code: 'en',
        iso: 'en-US',
        name: 'English',
        file: 'en.json'
      }
    ],
    defaultLocale: 'en',
    strategy: 'prefix_except_default',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_detected',
      redirectOn: 'root',
      fallbackLocale: 'en'
    }
  },
  ssr: true,
  vite: {
    plugins: [tailwindcss()]
  },
  nitro: {
    experimental: {
      wasm: true
    }
  },
  compatibilityDate: '2025-09-03'
});

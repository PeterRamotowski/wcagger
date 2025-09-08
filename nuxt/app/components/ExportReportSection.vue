<script setup lang="ts">
interface Emits {
  (e: 'export', format: 'json' | 'csv'): void;
  (e: 'generatePdf'): void;
}

defineEmits<Emits>();
</script>

<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
  <h3 class="text-lg font-semibold text-gray-900 mb-4">{{ $t('export_report') }}</h3>
    <div class="flex flex-wrap gap-4">
      <button
        @click="$emit('export', 'json')"
        class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 transition-colors"
      >
        {{ $t('export_json') }}
      </button>
      <button
        @click="$emit('export', 'csv')"
        class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 transition-colors"
      >
        {{ $t('export_csv') }}
      </button>
      <button
        @click="$emit('generatePdf')"
        class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 transition-colors"
      >
        {{ $t('generate_pdf_report') }}
      </button>
    </div>
  </div>
</template>

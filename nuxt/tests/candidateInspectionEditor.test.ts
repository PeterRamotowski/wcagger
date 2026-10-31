// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CandidateInspection from '../app/components/Evaluation/CandidateInspection.vue'
import type { CandidateInspection as Inspection } from '../shared/types/candidateInspection'
import en from '../i18n/locales/en.json'

const record: Inspection = { schemaVersion: 1, method: 'static-html-v1', requestedUrl: 'https://example.com/', finalUrl: 'https://example.com/', inspectedAt: '2026-10-24T12:00:00Z', durationLimitMs: 10000, byteLimit: 262144, bytes: 200, contentType: 'text/html', title: 'Page title', suggestedTypes: ['Forms'] }
const candidate = { id: 'candidate', url: 'https://example.com/', name: '', stateDescription: 'Initial page state', preparation: 'initial-page' as const }
const globals = { mocks: { $t: (key: string) => (en as Record<string, string>)[key] ?? key } }
describe('candidate inspection review', () => {
  it('runs only after an explicit request, preserves chosen limits and requires renewed confirmation after editing suggestions', async () => {
    const fetcher = vi.fn().mockResolvedValue(record)
    vi.stubGlobal('$fetch', fetcher)
    const wrapper = mount(CandidateInspection, { props: { candidates: [candidate], busy: false }, global: globals })
    expect(fetcher).not.toHaveBeenCalled()
    await wrapper.find('select').setValue(candidate.id)
    await wrapper.find('[data-inspection-run]').trigger('click')
    await flushPromises()
    expect(fetcher).toHaveBeenCalledWith('/api/candidate-inspection', { method: 'POST', body: { url: candidate.url, durationMs: 10000, byteLimit: 262144 } })
    expect(wrapper.find('[data-inspection-apply]').attributes('disabled')).toBeDefined()
    await wrapper.find('[data-inspection-confirm]').setValue(true)
    const fields = wrapper.findAll('[data-inspection-preview] input[type=text], [data-inspection-preview] input:not([type])')
    await fields[1]!.setValue('Contact form, Custom page')
    expect(wrapper.find('[data-inspection-confirm]').element).toHaveProperty('checked', false)
    await wrapper.find('[data-inspection-confirm]').setValue(true)
    await wrapper.find('[data-inspection-apply]').trigger('click')
    expect(wrapper.emitted('apply')![0]![0]).toMatchObject({ id: candidate.id, name: 'Page title', typeTags: ['Contact form', 'Custom page'], inspection: record })
    wrapper.unmount()
  })
  it('drops responses after the candidate context changes and never inspects manual preparation states', async () => {
    let finish!: (value: Inspection) => void
    const fetcher = vi.fn().mockReturnValue(new Promise<Inspection>((resolve) => {
      finish = resolve
    }))
    vi.stubGlobal('$fetch', fetcher)
    const wrapper = mount(CandidateInspection, { props: { candidates: [candidate], busy: false }, global: globals })
    await wrapper.find('select').setValue(candidate.id)
    await wrapper.find('[data-inspection-run]').trigger('click')
    await wrapper.setProps({ candidates: [{ ...candidate, url: 'https://example.com/changed' }] })
    finish(record)
    await flushPromises()
    expect(wrapper.find('[data-inspection-preview]').exists()).toBe(false)
    await wrapper.setProps({ candidates: [{ ...candidate, preparation: 'manual' }] })
    expect(wrapper.find('[data-inspection-run]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('needs manual preparation')
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('apply')).toBeUndefined()
    wrapper.unmount()
  })
  it('keeps failures visible without applying metadata or accepting too many labels', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce({ data: { statusMessage: 'The HTML body exceeds the chosen byte limit' } }).mockResolvedValueOnce(record)
    vi.stubGlobal('$fetch', fetcher)
    const wrapper = mount(CandidateInspection, { props: { candidates: [candidate], busy: false }, global: globals })
    await wrapper.find('select').setValue(candidate.id)
    await wrapper.find('[data-inspection-run]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role=alert]').text()).toContain('byte limit')
    expect(wrapper.emitted('apply')).toBeUndefined()
    await wrapper.find('[data-inspection-run]').trigger('click')
    await flushPromises()
    const fields = wrapper.findAll('[data-inspection-preview] input:not([type])')
    await fields[1]!.setValue(Array.from({ length: 21 }, (_, index) => 'Label ' + index).join(', '))
    await wrapper.find('[data-inspection-confirm]').setValue(true)
    expect(wrapper.find('[data-inspection-apply]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})

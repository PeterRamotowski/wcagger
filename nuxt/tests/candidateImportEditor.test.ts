// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CandidateImport from '../app/components/Evaluation/CandidateImport.vue'
import PlanningEditor from '../app/components/Evaluation/PlanningEditor.vue'
import { selectRandomSamples } from '../server/services/evaluationSamplingService'
import { newEvaluation } from '../shared/utils/evaluation'
import { savedFixture } from './fixtures/savedEvaluation'
import { validateSavedEvaluation } from '../shared/utils/savedEvaluation'
import en from '../i18n/locales/en.json'

const t = (key: string, params: Record<string, unknown> = {}) => Object.entries(params).reduce((text, [key, value]) => text.replace('{' + key + '}', String(value)), (en as Record<string, string>)[key] ?? key)
const globals = { mocks: { $t: t } }
async function preview(wrapper: ReturnType<typeof mount>, text: string) {
  await wrapper.find('select').setValue('json')
  await wrapper.find('textarea').setValue(text)
  await wrapper.findAll('button').find(button => button.text() === 'Preview inventory')!.trigger('click')
}
describe('candidate inventory review', () => {
  it('requires explicit confirmation, rechecks edited rows and imports only ready views without fetching', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    const wrapper = mount(CandidateImport, { props: { candidates: [], source: 'CMS inventory', busy: false }, global: globals })
    await preview(wrapper, JSON.stringify([{ url: 'https://example.com/' }, { url: 'https://example.com/' }, { url: '/invalid' }, { url: 'https://other.example/' }]))
    const apply = wrapper.find('[data-import-apply]')
    expect(wrapper.find('[data-import-counts]').text()).toContain('Ready: 2. Invalid: 1. Duplicates: 1.')
    expect(apply.attributes('disabled')).toBeDefined()
    await wrapper.find('[data-import-confirm]').setValue(true)
    await wrapper.findAll('[data-import-row]')[3]!.findAll('input')[0]!.setValue(false)
    expect(wrapper.find('[data-import-confirm]').element).toHaveProperty('checked', false)
    await wrapper.find('[data-import-confirm]').setValue(true)
    await apply.trigger('click')
    const event = wrapper.emitted('import')![0]![0] as { candidates: { url: string }[], source: string }
    expect(event.source).toBe('CMS inventory')
    expect(event.candidates.map(row => row.url)).toEqual(['https://example.com/'])
    expect(wrapper.text()).toContain('Added 1 candidates')
    expect(fetcher).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('translates sitemap index and XML declaration errors into actionable messages', async () => {
    const wrapper = mount(CandidateImport, { props: { candidates: [], source: '', busy: false }, global: globals })
    const button = wrapper.findAll('button').find(button => button.text() === 'Preview inventory')!
    await wrapper.find('textarea').setValue('<sitemapindex/>')
    await button.trigger('click')
    expect(wrapper.find('[role=alert]').text()).toContain('This is a sitemap index')
    await wrapper.find('textarea').setValue('<!DOCTYPE urlset><urlset/>')
    await button.trigger('click')
    expect(wrapper.find('[role=alert]').text()).toContain('entity declarations are not accepted')
    expect(wrapper.emitted('import')).toBeUndefined()
    wrapper.unmount()
  })
  it('blocks pool overflow and invalidates confirmation when the candidate population changes', async () => {
    const existing = Array.from({ length: 499 }, (_, index) => ({ id: 'old-' + index, url: 'https://example.com/' + index, name: '', stateDescription: 'Initial page state', preparation: 'initial-page' as const }))
    const wrapper = mount(CandidateImport, { props: { candidates: existing, source: 'Inventory', busy: false }, global: globals })
    await preview(wrapper, '[{"url":"https://example.com/new"},{"url":"https://example.com/other"}]')
    await wrapper.find('[data-import-confirm]').setValue(true)
    expect(wrapper.find('[data-import-apply]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Only 1 candidate slots remain')
    await wrapper.findAll('[data-import-row]')[1]!.find('input[type=checkbox]').setValue(false)
    await wrapper.find('[data-import-confirm]').setValue(true)
    expect(wrapper.find('[data-import-apply]').attributes('disabled')).toBeUndefined()
    await wrapper.setProps({ candidates: [...existing, { ...existing[0]!, id: 'last', url: 'https://example.com/last' }] })
    expect(wrapper.find('[data-import-confirm]').element).toHaveProperty('checked', false)
    expect(wrapper.find('[data-import-apply]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
  it('reads local files with a size guard and keeps format errors separate from the existing pool', async () => {
    const wrapper = mount(CandidateImport, { props: { candidates: [], source: '', busy: false }, global: globals })
    const fileInput = wrapper.find('input[type=file]')
    const text = vi.fn().mockResolvedValue('[{"url":"https://example.com/"}]')
    Object.defineProperty(fileInput.element, 'files', { configurable: true, value: [{ name: 'cms.json', size: 100, text }] })
    await wrapper.find('select').setValue('json')
    await fileInput.trigger('change')
    await flushPromises()
    await wrapper.findAll('button').find(button => button.text() === 'Preview inventory')!.trigger('click')
    expect(wrapper.findAll('textarea')[1]!.element).toHaveProperty('value', 'cms.json')
    await wrapper.find('textarea').setValue('{bad')
    expect(wrapper.find('[data-import-apply]').exists()).toBe(false)
    await wrapper.findAll('button').find(button => button.text() === 'Preview inventory')!.trigger('click')
    expect(wrapper.find('[role=alert]').text()).toContain('nothing was added')
    Object.defineProperty(fileInput.element, 'files', { configurable: true, value: [{ name: 'large.json', size: 1024 * 1024 + 1, text }] })
    await fileInput.trigger('change')
    await flushPromises()
    expect(text).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[role=alert]').text()).toContain('1 MiB')
    expect(wrapper.emitted('import')).toBeUndefined()
    wrapper.unmount()
  })
  it('appends to the pool, resets declared coverage and retains samples and historical draws across workspace validation', async () => {
    const workspace = savedFixture()
    let value = newEvaluation()
    value.samples[0]!.url = 'https://example.com/'
    value.sampling!.coverage = 'whole-scope'
    value.sampling!.source = 'Original inventory'
    value.sampling!.candidates = [{ id: 'drawn-candidate', url: 'https://example.com/random', name: '', stateDescription: 'Initial page state', preparation: 'initial-page' }]
    value = selectRandomSamples(value, () => 0)
    const previousSamples = structuredClone(value.samples)
    const wrapper = mount(PlanningEditor, { props: { 'modelValue': value, 'busy': false, 'onUpdate:modelValue': (modelValue) => {
      void wrapper.setProps({ modelValue })
    } }, global: globals })
    const importer = wrapper.findComponent(CandidateImport)
    await preview(importer, '[{"url":"https://example.com/new","name":"New page"}]')
    await importer.find('[data-import-confirm]').setValue(true)
    await importer.find('[data-import-apply]').trigger('click')
    const next = wrapper.props('modelValue')
    expect(next.sampling!.coverage).toBe('unknown')
    expect(next.samples).toEqual(previousSamples)
    expect(next.sampling!.draws).toEqual(value.sampling!.draws)
    workspace.evaluation = next
    const reopened = validateSavedEvaluation(workspace)
    expect(reopened.evaluation.sampling!.candidates.find(row => row.name === 'New page')).toMatchObject({ url: 'https://example.com/new', name: 'New page' })
    wrapper.unmount()
  })
})

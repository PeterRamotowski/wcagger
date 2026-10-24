import { ref, computed, onMounted, toRaw } from 'vue'
import type { SavedEvaluation, SavedEvaluationSummary } from '~~/shared/types/savedEvaluation'
import { newRecordId } from '~~/shared/utils/evaluation'
import { parseSavedEvaluation, validateSavedEvaluation } from '~~/shared/utils/savedEvaluation'
import { EvaluationStore } from '~~/app/utils/evaluationStore'
import { downloadFile } from '~~/app/utils/exportReport'

type Content = Omit<SavedEvaluation, 'format' | 'schemaVersion' | 'id' | 'revision' | 'savedAt'>
export function useSavedEvaluations(capture: () => Content, restore: (value: SavedEvaluation) => void, reset: () => void) {
  const id = ref(newRecordId())
  const revision = ref(0)
  const entries = ref<SavedEvaluationSummary[]>([])
  const error = ref<string | null>(null)
  const status = ref('')
  const busy = ref(false)
  // Scan/report payloads are immutable snapshots. Compare their identities instead of
  // serializing all raw evidence again on every edit to an evaluation label or note.
  const identities = new WeakMap<object, number>()
  let nextIdentity = 0
  const identity = (value: object | null) => {
    if (!value) return null
    const raw = toRaw(value)
    if (!identities.has(raw)) identities.set(raw, ++nextIdentity)
    return identities.get(raw)
  }
  const fingerprint = () => {
    const value = capture()
    return JSON.stringify({ ...value, scans: Object.fromEntries(Object.entries(value.scans).map(([id, scan]) => [id, identity(scan)])), scanHistory: value.scanHistory.map(identity), report: identity(value.report), reportHistory: value.reportHistory.map(identity) })
  }
  const baseline = ref(fingerprint())
  const dirty = computed(() => fingerprint() !== baseline.value)
  const store = () => new EvaluationStore()
  const refresh = async () => {
    entries.value = await store().list()
  }
  const action = async (callback: () => Promise<void>) => {
    if (busy.value) return
    busy.value = true
    error.value = null
    status.value = ''
    try {
      await callback()
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Could not access saved evaluations'
    } finally {
      busy.value = false
    }
  }
  const snapshot = () => validateSavedEvaluation({ format: 'wcagger-workspace', schemaVersion: 1, id: id.value, revision: revision.value, savedAt: new Date().toISOString(), ...capture() })
  const save = () => action(async () => {
    const saved = await store().save(snapshot())
    revision.value = saved.revision
    baseline.value = fingerprint()
    status.value = 'saved'
    await refresh()
  })
  const load = (entryId: string) => action(async () => {
    if (dirty.value) throw new Error('Save or download the current work, then discard the draft before opening another evaluation.')
    const saved = await store().get(entryId)
    restore(saved)
    id.value = saved.id
    revision.value = saved.revision
    baseline.value = fingerprint()
    status.value = 'opened'
  })
  const backup = () => action(async () => {
    const saved = snapshot()
    downloadFile(JSON.stringify(saved, null, 2), 'wcagger-workspace-' + new Date().toISOString().slice(0, 10) + '.json', 'application/json')
    status.value = 'backup'
  })
  const importFile = (text: string) => action(async () => {
    if (dirty.value) throw new Error('Save or download the current work, then discard the draft before importing a backup.')
    const value = parseSavedEvaluation(text)
    value.id = newRecordId()
    value.revision = 0
    // A backup always opens as an independent local copy; it never overwrites another record.
    restore(value)
    id.value = value.id
    revision.value = 0
    baseline.value = ''
    status.value = 'imported'
  })
  const remove = (entryId: string) => action(async () => {
    await store().remove(entryId, entries.value.find(entry => entry.id === entryId)?.revision)
    if (entryId === id.value) {
      id.value = newRecordId()
      revision.value = 0
      baseline.value = ''
    }
    await refresh()
    status.value = 'removed'
  })
  const discard = () => {
    if (busy.value) return
    reset()
    id.value = newRecordId()
    revision.value = 0
    baseline.value = fingerprint()
    error.value = null
    status.value = ''
  }
  onMounted(() => {
    void action(refresh)
  })
  const refreshList = () => action(refresh)
  return { refreshList, entries, error, status, busy, dirty, save, load, backup, importFile, remove, discard }
}

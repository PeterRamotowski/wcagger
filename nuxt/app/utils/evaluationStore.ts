import type { SavedEvaluation, SavedEvaluationSummary } from '~~/shared/types/savedEvaluation'
import { validateSavedEvaluation } from '~~/shared/utils/savedEvaluation'

// Browser-origin/profile access only. No account, server synchronization or encryption is implied.
export class EvaluationStore {
  constructor(private factory: IDBFactory = indexedDB) {}
  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = this.factory.open('wcagger-evaluations', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('evaluations', { keyPath: 'id' })
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Browser storage is unavailable'))
      request.onblocked = () => reject(new Error('Close other WCAGger tabs to update browser storage'))
    })
  }

  private async transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore, done: (value: T) => void, fail: (error: Error) => void) => void): Promise<T> {
    const database = await this.open()
    try {
      return await new Promise<T>((resolve, reject) => {
        const transaction = database.transaction('evaluations', mode)
        let result: T
        let failure: Error | undefined
        transaction.oncomplete = () => resolve(result)
        transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('Browser storage operation failed'))
        transaction.onerror = () => { /* The abort handler reports the failure once. */ }
        action(transaction.objectStore('evaluations'), (value) => {
          result = value
        }, (error) => {
          failure = error
          transaction.abort()
        })
      })
    } finally { database.close() }
  }

  async list(): Promise<SavedEvaluationSummary[]> {
    return this.transaction('readonly', (store, done) => {
      const request = store.getAll()
      request.onsuccess = () => done((request.result as SavedEvaluation[]).map(value => ({ id: value.id, revision: value.revision, savedAt: value.savedAt, name: value.evaluation.name, samples: value.evaluation.samples.length })).sort((a, b) => b.savedAt.localeCompare(a.savedAt)))
    })
  }

  async get(id: string): Promise<SavedEvaluation> {
    const value = await this.transaction<unknown>('readonly', (store, done) => {
      const request = store.get(id)
      request.onsuccess = () => done(request.result)
    })
    if (!value) throw new Error('Saved evaluation no longer exists')
    return validateSavedEvaluation(value)
  }

  async save(input: SavedEvaluation): Promise<SavedEvaluation> {
    const value = validateSavedEvaluation(input)
    value.savedAt = new Date().toISOString()
    return this.transaction('readwrite', (store, done, fail) => {
      const request = store.get(value.id)
      request.onsuccess = () => {
        const existing = request.result as SavedEvaluation | undefined
        if ((existing?.revision ?? 0) !== value.revision) {
          fail(new Error('Another tab changed this saved evaluation. Download a backup, then reopen it before saving.'))
          return
        }
        if (existing?.revision === undefined && value.revision !== 0) {
          fail(new Error('Saved evaluation was removed. Import a backup as a separate copy.'))
          return
        }
        value.revision++
        try {
          store.put(value)
          done(value)
        } catch (error) {
          fail(error instanceof Error ? error : new Error('Could not save to browser storage'))
        }
      }
    })
  }

  async remove(id: string, expectedRevision?: number): Promise<void> {
    return this.transaction('readwrite', (store, done, fail) => {
      const request = store.get(id)
      request.onsuccess = () => {
        if (request.result && expectedRevision !== undefined && request.result.revision !== expectedRevision) {
          fail(new Error('Another tab changed this saved evaluation. Refresh the list before deleting it.'))
          return
        }
        store.delete(id)
        done()
      }
    })
  }
}

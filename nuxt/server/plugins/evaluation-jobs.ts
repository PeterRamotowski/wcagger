import { evaluationJobs } from '~~/server/services/evaluationJobService'

export default defineNitroPlugin(async () => {
  await evaluationJobs.start()
})

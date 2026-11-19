import { authenticatedLiraRequest } from './catalogService'

export async function listKnowledgeEntries() {
  const entries = []
  for (let page = 1; ; page++) {
    const result = await authenticatedLiraRequest(`/knowledge/entries?page=${page}&limit=100`, { cache: 'no-store' })
    if (!Array.isArray(result?.items)) throw new Error('The knowledge entries could not be loaded.')
    entries.push(...result.items)
    if (result.items.length < 100) return entries
  }
}

export function createKnowledgeEntry(entry) {
  return authenticatedLiraRequest('/knowledge/entries', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry),
  })
}

export function updateKnowledgeEntry(id, entry, expectedUpdatedAt) {
  return authenticatedLiraRequest(`/knowledge/entries/${encodeURIComponent(id)}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...entry, expectedUpdatedAt }),
  })
}

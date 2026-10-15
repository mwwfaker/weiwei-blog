// Records created in this browser carry a string id; records from the server keep their numeric id.
// That is an unambiguous "not yet synced" marker, unlike guessing from the magnitude of a number.

export function localId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function isLocalId(id) {
  return typeof id === 'string' && id.startsWith('local-')
}

function groupNotesByDate(notes) {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)
  const sevenDaysAgo = new Date(startOfToday)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const thirtyDaysAgo = new Date(startOfToday)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const pinned = []
  const buckets = new Map()
  const order = []

  function pushTo(label, note) {
    if (!buckets.has(label)) {
      buckets.set(label, [])
      order.push(label)
    }
    buckets.get(label).push(note)
  }

  for (const note of notes) {
    if (note.pinned) {
      pinned.push(note)
      continue
    }
    const updated = new Date(note.updated_at)
    let label
    if (updated >= startOfToday) label = 'Today'
    else if (updated >= startOfYesterday) label = 'Yesterday'
    else if (updated >= sevenDaysAgo) label = 'Previous 7 Days'
    else if (updated >= thirtyDaysAgo) label = 'Previous 30 Days'
    else {
      label = updated.toLocaleDateString(undefined, {
        month: 'long',
        year: updated.getFullYear() === now.getFullYear() ? undefined : 'numeric',
      })
    }
    pushTo(label, note)
  }

  return { pinned, groups: order.map((label) => ({ label, notes: buckets.get(label) })) }
}

function formatNoteDate(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (date >= startOfToday) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  const sameYear = date.getFullYear() === now.getFullYear()
  return date.toLocaleDateString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: sameYear ? undefined : '2-digit',
  })
}

function notePreview(note) {
  const rest = (note.body || '').trim().split('\n').find((l) => l.trim().length > 0) || ''
  return rest
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str ?? ''
  return div.innerHTML
}

function renderNotesListView(root, { onOpenNote, onCreateNote }) {
  let query = ''

  function noteRowHtml(note, pinnedSection) {
    const title = (note.title || '').trim() || 'New Note'
    const preview = notePreview(note)
    const dateLabel = formatNoteDate(note.updated_at)
    return `
      <button class="note-row" data-id="${note.id}">
        <div class="note-row-title ${note.title.trim() ? '' : 'muted'}">
          ${pinnedSection ? Icon.pinFilled.replace('<svg', '<svg class="pin-icon-mini"') : ''}
          ${escapeHtml(title)}
        </div>
        <div class="note-row-sub">${escapeHtml(dateLabel)}${preview ? '  ' + escapeHtml(preview) : ''}</div>
      </button>
    `
  }

  function sectionHtml(title, notes, pinnedSection) {
    return `
      <div class="notes-section">
        <div class="section-title">${escapeHtml(title)}</div>
        <div class="note-list">
          ${notes.map((n) => noteRowHtml(n, pinnedSection)).join('')}
        </div>
      </div>
    `
  }

  function draw() {
    const filtered = query.trim()
      ? Notes.items.filter(
          (n) =>
            n.title.toLowerCase().includes(query.trim().toLowerCase()) ||
            n.body.toLowerCase().includes(query.trim().toLowerCase())
        )
      : Notes.items

    const { pinned, groups } = groupNotesByDate(filtered)
    const isEmpty = !Notes.loading && Notes.items.length === 0

    let bodyHtml = ''
    if (isEmpty) {
      bodyHtml = `
        <div class="empty-state">
          <div class="empty-title">No Notes Yet</div>
          <div class="empty-sub">Notes you create are saved automatically as you type.</div>
          <button class="link-btn" id="empty-create">Create your first note</button>
        </div>
      `
    } else {
      if (pinned.length) bodyHtml += sectionHtml('Pinned', pinned, true)
      groups.forEach((g) => {
        bodyHtml += sectionHtml(g.label, g.notes, false)
      })
    }

    root.innerHTML = `
      <div class="view-col">
        <div class="list-header">
          <h1 class="page-title">Notes</h1>
          <div class="search-bar">
            ${Icon.search}
            <input type="text" id="search-input" placeholder="Search" value="${escapeHtml(query)}" />
          </div>
        </div>
        <div class="list-scroll" id="list-scroll">${bodyHtml}</div>
        <button class="fab" id="fab-add" aria-label="New note">${Icon.plus}</button>
      </div>
    `

    const searchInput = root.querySelector('#search-input')
    searchInput.oninput = (e) => {
      query = e.target.value
      const caret = e.target.selectionStart
      draw()
      const newInput = root.querySelector('#search-input')
      newInput.focus()
      newInput.setSelectionRange(caret, caret)
    }

    root.querySelectorAll('.note-row').forEach((el) => {
      el.onclick = () => onOpenNote(el.dataset.id)
    })

    root.querySelector('#fab-add').onclick = onCreateNote
    const emptyCreate = root.querySelector('#empty-create')
    if (emptyCreate) emptyCreate.onclick = onCreateNote
  }

  draw()
  return { refresh: draw }
}

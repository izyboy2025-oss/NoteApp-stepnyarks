function renderTrashView(root, { userId, onBack, renderNav }) {
  root.innerHTML = `
    <div class="view-col">
      <header class="editor-header">
        <button class="link-btn back-btn" id="trash-back-btn">${Icon.chevronLeft}<span>Notes</span></button>
      </header>
      <div class="list-header" style="padding-top:0">
        <h1 class="page-title" style="font-size:28px;margin-top:0">Trash</h1>
        <div class="hint" style="margin-bottom:0">Notes stay here for 60 days, then delete automatically.</div>
      </div>
      <div class="list-scroll" id="trash-scroll" style="padding-bottom:24px"></div>
      <div id="trash-nav-slot" class="mobile-nav-slot"></div>
    </div>
  `

  root.querySelector('#trash-back-btn').onclick = onBack
  if (renderNav) renderNav(root.querySelector('#trash-nav-slot'))

  function rowHtml(note) {
    const title = (note.title || '').trim() || 'New Note'
    const daysLeft = Notes.daysRemaining(note)
    const daysLabel = daysLeft === 0 ? 'Deletes today' : daysLeft === 1 ? '1 day left' : `${daysLeft} days left`
    return `
      <div class="trash-row">
        <div class="trash-row-main">
          <div class="note-row-title ${note.title.trim() ? '' : 'muted'}">${escapeHtml(title)}</div>
          <div class="note-row-sub">${escapeHtml(daysLabel)}</div>
        </div>
        <div class="trash-row-actions">
          <button class="icon-btn" data-restore="${note.id}" aria-label="Restore">${Icon.refresh}</button>
          <button class="icon-btn" data-delete-forever="${note.id}" aria-label="Delete permanently">${Icon.trash}</button>
        </div>
      </div>
    `
  }

  function draw() {
    const scroll = root.querySelector('#trash-scroll')
    if (Notes.trashLoading) {
      scroll.innerHTML = ''
      return
    }
    if (Notes.trashItems.length === 0) {
      scroll.innerHTML = `
        <div class="empty-state">
          <div class="empty-title">Trash Is Empty</div>
          <div class="empty-sub">Deleted notes will show up here for 60 days.</div>
        </div>
      `
      return
    }
    scroll.innerHTML = `
      <div class="note-list">${Notes.trashItems.map(rowHtml).join('')}</div>
      <button class="link-btn" id="empty-trash-btn" style="display:block;margin:20px auto 0;color:var(--danger)">
        Delete All Permanently
      </button>
    `

    scroll.querySelectorAll('[data-restore]').forEach((el) => {
      el.onclick = () => Notes.restoreNote(el.dataset.restore)
    })
    scroll.querySelectorAll('[data-delete-forever]').forEach((el) => {
      el.onclick = () => {
        if (confirm('Delete this note permanently? This can\u2019t be undone.')) {
          Notes.deleteForever(el.dataset.deleteForever)
        }
      }
    })
    const emptyBtn = scroll.querySelector('#empty-trash-btn')
    if (emptyBtn) {
      emptyBtn.onclick = () => {
        if (confirm('Permanently delete all notes in Trash? This can\u2019t be undone.')) {
          Notes.emptyTrash(userId)
        }
      }
    }
  }

  draw()
  const unsubscribe = Notes.onChange(draw)
  Notes.loadTrash(userId)

  return {
    destroy() {
      unsubscribe()
    },
  }
}

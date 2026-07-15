function renderNoteEditorView(root, { note, onBack, onDelete, onTogglePin }) {
  root.innerHTML = `
    <div class="view-col">
      <header class="editor-header">
        <button class="link-btn back-btn" id="back-btn">${Icon.chevronLeft}<span>Notes</span></button>
        <div class="editor-actions">
          <button class="icon-btn" id="undo-btn" aria-label="Undo" disabled>${Icon.undo}</button>
          <button class="icon-btn" id="redo-btn" aria-label="Redo" disabled>${Icon.redo}</button>
          <span class="editor-actions-divider"></span>
          <button class="icon-btn ${note.pinned ? 'accent' : ''}" id="pin-btn">${note.pinned ? Icon.pinFilled : Icon.pin}</button>
          <button class="icon-btn" id="more-btn">${Icon.more}</button>
          <div class="menu-popover hidden" id="menu-popover">
            <button class="menu-item danger" id="delete-btn">${Icon.trash} Delete Note</button>
          </div>
        </div>
      </header>

      <div class="editor-scroll" id="editor-scroll">
        <textarea id="title-input" class="title-input" placeholder="Title" rows="1">${escapeHtml(note.title)}</textarea>
        <textarea id="body-input" class="body-input" placeholder="Start typing…">${escapeHtml(note.body)}</textarea>
      </div>
    </div>
  `

  const titleInput = root.querySelector('#title-input')
  const bodyInput = root.querySelector('#body-input')
  const menu = root.querySelector('#menu-popover')

  function autoGrow(el) {
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }
  // Measuring scrollHeight only works once the element is actually laid out
  // and visible — on mobile the panel can still be display:none at the
  // instant this view is built, so defer the first sizing to the next frame.
  requestAnimationFrame(() => autoGrow(titleInput))
  titleInput.addEventListener('input', () => autoGrow(titleInput))

  // Brand-new note: put the cursor straight into the title so it's obvious
  // where to start typing.
  if (!note.title && !note.body) {
    setTimeout(() => titleInput.focus(), 0)
  }

  function persist() {
    Notes.updateNote(note.id, { title: titleInput.value, body: bodyInput.value })
  }

  // --- Undo / redo -------------------------------------------------------
  // A small in-memory history for this editing session only. It never talks
  // to Supabase directly — undo/redo just puts old text back into the same
  // fields normal typing uses, so it rides the exact same autosave pipeline
  // (debounced save via persist()) as everything else. Nothing here can
  // touch any note other than the one currently open, and the history is
  // discarded the moment you leave this note.
  let history = [{ title: note.title, body: note.body }]
  let historyIndex = 0
  let historyTimer = null

  const undoBtn = root.querySelector('#undo-btn')
  const redoBtn = root.querySelector('#redo-btn')

  function updateHistoryButtons() {
    undoBtn.disabled = historyIndex <= 0
    redoBtn.disabled = historyIndex >= history.length - 1
  }

  function scheduleHistorySnapshot() {
    clearTimeout(historyTimer)
    historyTimer = setTimeout(() => {
      const current = { title: titleInput.value, body: bodyInput.value }
      const last = history[historyIndex]
      if (current.title === last.title && current.body === last.body) return
      history = history.slice(0, historyIndex + 1)
      history.push(current)
      historyIndex = history.length - 1
      updateHistoryButtons()
    }, 700)
  }

  function applyHistoryState(state) {
    titleInput.value = state.title
    bodyInput.value = state.body
    autoGrow(titleInput)
    persist()
    updateHistoryButtons()
  }

  undoBtn.onclick = () => {
    if (historyIndex <= 0) return
    historyIndex -= 1
    applyHistoryState(history[historyIndex])
  }

  redoBtn.onclick = () => {
    if (historyIndex >= history.length - 1) return
    historyIndex += 1
    applyHistoryState(history[historyIndex])
  }

  updateHistoryButtons()

  titleInput.addEventListener('input', persist)
  bodyInput.addEventListener('input', persist)
  titleInput.addEventListener('input', scheduleHistorySnapshot)
  bodyInput.addEventListener('input', scheduleHistorySnapshot)

  root.querySelector('#back-btn').onclick = async () => {
    await Notes.flushNow()
    onBack()
  }

  root.querySelector('#pin-btn').onclick = () => {
    note.pinned = !note.pinned
    onTogglePin(note.id, note.pinned)
    root.querySelector('#pin-btn').innerHTML = note.pinned ? Icon.pinFilled : Icon.pin
    root.querySelector('#pin-btn').classList.toggle('accent', note.pinned)
  }

  root.querySelector('#more-btn').onclick = (e) => {
    e.stopPropagation()
    menu.classList.toggle('hidden')
  }
  document.addEventListener('click', () => menu.classList.add('hidden'))

  root.querySelector('#delete-btn').onclick = () => onDelete(note.id)

  return {
    destroy() {
      clearTimeout(historyTimer)
    },
  }
}

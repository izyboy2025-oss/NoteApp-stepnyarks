function renderNoteEditorView(root, { note, onBack, onDelete, onTogglePin }) {
  root.innerHTML = `
    <div class="view-col">
      <header class="editor-header">
        <button class="link-btn back-btn" id="back-btn">${Icon.chevronLeft}<span>Notes</span></button>
        <div class="editor-actions">
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

  titleInput.addEventListener('input', persist)
  bodyInput.addEventListener('input', persist)

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
    destroy() {},
  }
}

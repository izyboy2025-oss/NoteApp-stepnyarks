;(function () {
  const root = document.getElementById('root')

  let mainContent = null // null | {type:'editor', noteId} | {type:'settings'}
  let currentDestroy = null // cleanup for whatever is in #main-pane
  let sidebarDestroy = null
  let notesListController = null

  function shell() {
    return `
      <div class="app-shell" id="app-shell">
        <div class="sidebar" id="sidebar"></div>
        <div class="main-pane" id="main-pane"></div>
      </div>
    `
  }

  function updateShellState() {
    const shellEl = document.getElementById('app-shell')
    if (!shellEl) return
    shellEl.classList.toggle('detail-open', mainContent !== null)
  }

  function renderSidebar() {
    if (sidebarDestroy) sidebarDestroy()
    const sidebarEl = document.getElementById('sidebar')
    sidebarEl.innerHTML = `<div class="sidebar-inner"><div id="list-slot" class="list-slot"></div><div id="nav-slot"></div></div>`

    notesListController = renderNotesListView(sidebarEl.querySelector('#list-slot'), {
      onOpenNote: (id) => {
        mainContent = { type: 'editor', noteId: id }
        updateShellState()
        renderMain()
      },
      onCreateNote: async () => {
        const note = await Notes.createNote(Auth.user.id)
        if (note) {
          mainContent = { type: 'editor', noteId: note.id }
          updateShellState()
          renderMain()
        }
      },
    })

    renderBottomNav(sidebarEl.querySelector('#nav-slot'))
  }

  function renderBottomNav(navEl) {
    const activeTab = mainContent && mainContent.type === 'settings' ? 'settings' : 'notes'
    navEl.innerHTML = `
      <nav class="bottom-nav">
        <button class="nav-btn ${activeTab === 'notes' ? 'active' : ''}" id="nav-notes">
          ${Icon.file}<span>Notes</span>
        </button>
        <button class="nav-btn ${activeTab === 'settings' ? 'active' : ''}" id="nav-settings">
          ${Icon.settings}<span>Settings</span>
        </button>
      </nav>
    `
    navEl.querySelector('#nav-notes').onclick = () => {
      mainContent = null
      updateShellState()
      renderMain()
      renderSidebar()
    }
    navEl.querySelector('#nav-settings').onclick = () => {
      mainContent = { type: 'settings' }
      updateShellState()
      renderMain()
      renderSidebar()
    }
  }

  function renderMain() {
    if (currentDestroy) {
      currentDestroy()
      currentDestroy = null
    }
    const mainEl = document.getElementById('main-pane')

    if (!mainContent) {
      mainEl.innerHTML = `<div class="placeholder-pane">${Icon.file}<div>Select a note, or create a new one.</div></div>`
      return
    }

    if (mainContent.type === 'editor') {
      const note = Notes.get(mainContent.noteId)
      if (!note) {
        mainContent = null
        mainEl.innerHTML = `<div class="placeholder-pane">${Icon.file}<div>Select a note, or create a new one.</div></div>`
        return
      }
      const result = renderNoteEditorView(mainEl, {
        note,
        onBack: () => {
          mainContent = null
          updateShellState()
          renderMain()
          renderSidebar()
        },
        onDelete: async (id) => {
          await Notes.deleteNote(id)
          mainContent = null
          updateShellState()
          renderMain()
          renderSidebar()
        },
        onTogglePin: (id, pinned) => Notes.togglePin(id, pinned),
      })
      currentDestroy = result.destroy
      return
    }

    if (mainContent.type === 'settings') {
      const result = renderSettingsView(mainEl, {
        user: Auth.user,
        onBack: () => {
          mainContent = null
          updateShellState()
          renderMain()
          renderSidebar()
        },
        onSignOut: async () => {
          await Auth.signOut()
        },
      })
      currentDestroy = result.destroy
    }
  }

  async function renderSignedIn() {
    root.innerHTML = shell()
    await Notes.load(Auth.user.id)
    renderSidebar()
    renderMain()
    updateShellState()

    Notes.onChange(() => {
      // keep the list section fresh (titles/snippets/order can change while
      // editing elsewhere) without tearing down the whole sidebar on every
      // keystroke.
      if (notesListController) notesListController.refresh()
    })
  }

  function renderSignedOut() {
    root.innerHTML = `<div class="app-shell single"><div id="auth-slot" class="view-col"></div></div>`
    renderAuthView(document.getElementById('auth-slot'))
  }

  function renderLoading() {
    root.innerHTML = `<div class="app-shell single"></div>`
  }

  let renderedFor = 'loading'
  Auth.onChange((session) => {
    if (session === undefined) {
      if (renderedFor !== 'loading') {
        renderedFor = 'loading'
        renderLoading()
      }
      return
    }
    if (session === null) {
      renderedFor = 'signedout'
      renderSignedOut()
      return
    }
    renderedFor = 'signedin'
    renderSignedIn()
  })

  renderLoading()
  Auth.init()
})()

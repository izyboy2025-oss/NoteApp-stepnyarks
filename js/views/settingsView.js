function renderSettingsView(root, { user, onBack, onSignOut }) {
  const hasGoogle = (user?.app_metadata?.providers || []).includes('google')
  const hasPassword = (user?.app_metadata?.providers || []).includes('email')

  root.innerHTML = `
    <div class="view-col">
      <header class="editor-header settings-header">
        <button class="link-btn back-btn" id="settings-back-btn">${Icon.chevronLeft}<span>Notes</span></button>
      </header>
      <div class="settings-scroll">
        <h1 class="page-title">Settings</h1>

        <div class="section-label">Account</div>
        <div class="card">
          <div class="row">${escapeHtml(user?.email || '')}</div>
        </div>

        <div class="section-label">Backup</div>
        <div class="card">
          <div class="pad">
            <div class="hint">Your notes back up automatically to the cloud as you type — there's nothing you need to do. Use this if you'd like to confirm everything is up to date right now.</div>
            <button class="btn btn-accent btn-icon" id="backup-btn">${Icon.refresh} <span id="backup-label">Back Up Now</span></button>
            <div class="sync-hint" id="sync-hint"></div>
          </div>
        </div>

        <div class="section-label">Import Notes</div>
        <div class="card">
          <div class="pad">
            <div class="hint">Bring notes in from a JSON file — each item should look like <code>{"title": "...", "body": "..."}</code>. Existing notes are left untouched; imported notes are added alongside them.</div>
            <input type="file" accept="application/json,.json" id="import-file" style="display:block;font-size:13px;margin-bottom:10px" />
            <button class="btn btn-dark btn-icon" id="import-btn" disabled>${Icon.file} <span id="import-label">Choose a file first</span></button>
            <div class="form-msg" id="import-error" style="color:var(--danger)"></div>
            <div class="form-msg" id="import-info" style="color:var(--success)"></div>
          </div>
        </div>

        <div class="section-label">Sign in on another device</div>
        <div class="card">
          <div class="pad">
            ${!hasGoogle ? `<button class="btn btn-outline btn-icon" id="google-connect" style="margin-bottom:14px">${Icon.globe} Connect Google Sign-In</button>` : ''}
            <div class="hint">${hasPassword ? "You have a password set. Use it with your email to sign in from any device." : "Set a password so you can sign in with your email on a device where Google sign-in isn't available."}</div>
            <form id="pw-form">
              <div class="field-row field-row-tight">${Icon.key}<input type="password" id="pw1" placeholder="New password" /></div>
              <div class="field-row field-row-tight">${Icon.key}<input type="password" id="pw2" placeholder="Confirm password" /></div>
              <div class="form-msg" id="pw-error" style="color:var(--danger)"></div>
              <div class="form-msg" id="pw-info" style="color:var(--success)"></div>
              <button type="submit" class="btn btn-dark" id="pw-submit" style="margin-top:10px" disabled>
                ${hasPassword ? 'Update Password' : 'Set Password'}
              </button>
            </form>
          </div>
        </div>

        <div class="section-label">&nbsp;</div>
        <div class="card">
          <button class="btn-plain danger" id="signout-btn">${Icon.logout} Sign Out</button>
        </div>
      </div>
    </div>
  `

  function updateSyncUi() {
    const label = root.querySelector('#backup-label')
    const hint = root.querySelector('#sync-hint')
    const btn = root.querySelector('#backup-btn')
    if (!label) return
    label.textContent = Notes.syncStatus === 'saving' ? 'Backing up…' : 'Back Up Now'
    btn.classList.toggle('busy', Notes.syncStatus === 'saving')
    hint.textContent = Notes.lastSyncedAt
      ? `Last backed up ${Notes.lastSyncedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
      : 'Not backed up yet'
  }
  updateSyncUi()
  const unsubscribe = Notes.onChange(updateSyncUi)

  root.querySelector('#backup-btn').onclick = () => Notes.flushNow()

  const googleBtn = root.querySelector('#google-connect')
  if (googleBtn) {
    googleBtn.onclick = async () => {
      try {
        await Auth.signInWithGoogle()
      } catch (e) {
        alert(e.message || 'Could not connect Google.')
      }
    }
  }

  const pw1 = root.querySelector('#pw1')
  const pw2 = root.querySelector('#pw2')
  const pwSubmit = root.querySelector('#pw-submit')
  const pwError = root.querySelector('#pw-error')
  const pwInfo = root.querySelector('#pw-info')

  function checkPwEnabled() {
    pwSubmit.disabled = !pw1.value || !pw2.value
  }
  pw1.oninput = checkPwEnabled
  pw2.oninput = checkPwEnabled

  root.querySelector('#pw-form').onsubmit = async (e) => {
    e.preventDefault()
    pwError.textContent = ''
    pwInfo.textContent = ''
    if (pw1.value.length < 8) {
      pwError.textContent = 'Password should be at least 8 characters.'
      return
    }
    if (pw1.value !== pw2.value) {
      pwError.textContent = "Passwords don't match."
      return
    }
    pwSubmit.disabled = true
    try {
      await Auth.setNewPassword(pw1.value)
      pwInfo.textContent = 'Password set.'
      pw1.value = ''
      pw2.value = ''
    } catch (err) {
      pwError.textContent = err.message || 'Could not set password.'
    } finally {
      checkPwEnabled()
    }
  }

  root.querySelector('#signout-btn').onclick = onSignOut
  root.querySelector('#settings-back-btn').onclick = onBack

  const importFile = root.querySelector('#import-file')
  const importBtn = root.querySelector('#import-btn')
  const importLabel = root.querySelector('#import-label')
  const importError = root.querySelector('#import-error')
  const importInfo = root.querySelector('#import-info')
  let selectedFile = null

  importFile.onchange = () => {
    selectedFile = importFile.files[0] || null
    importError.textContent = ''
    importInfo.textContent = ''
    importBtn.disabled = !selectedFile
    importLabel.textContent = selectedFile ? `Import "${selectedFile.name}"` : 'Choose a file first'
  }

  importBtn.onclick = async () => {
    if (!selectedFile) return
    importError.textContent = ''
    importInfo.textContent = ''
    importBtn.disabled = true

    try {
      const text = await selectedFile.text()
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) throw new Error('That file should contain a JSON array of notes.')
      if (parsed.length === 0) throw new Error('That file has no notes in it.')

      importLabel.textContent = `Importing 0 / ${parsed.length}…`
      await Notes.importNotes(user.id, parsed, (done, total) => {
        importLabel.textContent = `Importing ${done} / ${total}…`
      })
      importInfo.textContent = `Imported ${parsed.length} note${parsed.length === 1 ? '' : 's'}.`
      importLabel.textContent = 'Choose a file first'
      importFile.value = ''
      selectedFile = null
    } catch (err) {
      importError.textContent = err.message || 'Could not import that file.'
      importLabel.textContent = selectedFile ? `Import "${selectedFile.name}"` : 'Choose a file first'
    } finally {
      importBtn.disabled = !selectedFile
    }
  }

  return {
    destroy() {
      unsubscribe()
    },
  }
}

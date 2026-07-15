const AUTOSAVE_DELAY_MS = 700
const TRASH_RETENTION_DAYS = 60

const Notes = {
  items: [],
  trashItems: [],
  loading: true,
  trashLoading: true,
  syncStatus: 'idle', // idle | saving | saved | error
  lastSyncedAt: null,
  listeners: [],

  _timers: new Map(),
  _pending: new Map(),
  _inFlight: 0,

  onChange(fn) {
    this.listeners.push(fn)
    return () => {
      this.listeners = this.listeners.filter((f) => f !== fn)
    }
  },

  _notify() {
    this.listeners.forEach((fn) => fn())
  },

  async load(userId) {
    this.loading = true
    this._notify()
    const { data, error } = await db
      .from('notes')
      .select('*')
      .eq('is_deleted', false)
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false })

    if (!error) this.items = data || []
    this.loading = false
    this._notify()
  },

  async loadTrash(userId) {
    this.trashLoading = true
    this._notify()
    const { data, error } = await db
      .from('notes')
      .select('*')
      .eq('is_deleted', true)
      .order('deleted_at', { ascending: false })

    if (!error) this.trashItems = data || []
    this.trashLoading = false
    this._notify()
  },

  // Permanently removes anything that's been in the trash longer than the
  // retention window. Runs quietly whenever the app loads or Trash is opened.
  async purgeExpired(userId) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - TRASH_RETENTION_DAYS)
    await db
      .from('notes')
      .delete()
      .eq('user_id', userId)
      .eq('is_deleted', true)
      .lt('deleted_at', cutoff.toISOString())
  },

  async _writeToServer(noteId) {
    const fields = this._pending.get(noteId)
    if (!fields) return
    this._pending.delete(noteId)

    this._inFlight += 1
    this.syncStatus = 'saving'
    this._notify()

    const { error } = await db.from('notes').update(fields).eq('id', noteId)
    this._inFlight -= 1

    if (error) {
      this.syncStatus = 'error'
      this._notify()
      return
    }
    if (this._inFlight === 0 && this._pending.size === 0) {
      this.syncStatus = 'saved'
      this.lastSyncedAt = new Date()
      this._notify()
    }
  },

  _scheduleSave(noteId, fields) {
    const existing = this._pending.get(noteId) || {}
    this._pending.set(noteId, { ...existing, ...fields })

    const existingTimer = this._timers.get(noteId)
    if (existingTimer) clearTimeout(existingTimer)

    const timer = setTimeout(() => {
      this._timers.delete(noteId)
      this._writeToServer(noteId)
    }, AUTOSAVE_DELAY_MS)
    this._timers.set(noteId, timer)
  },

  // Used by the Settings "Back Up Now" button and when leaving the editor.
  async flushNow() {
    const ids = Array.from(this._timers.keys())
    ids.forEach((id) => {
      clearTimeout(this._timers.get(id))
      this._timers.delete(id)
    })
    const pendingIds = Array.from(this._pending.keys())
    await Promise.all(pendingIds.map((id) => this._writeToServer(id)))
    if (pendingIds.length === 0) {
      this.syncStatus = 'saved'
      this.lastSyncedAt = new Date()
      this._notify()
    }
  },

  async createNote(userId) {
    const now = new Date().toISOString()
    const { data, error } = await db
      .from('notes')
      .insert({ user_id: userId, title: '', body: '', created_at: now, updated_at: now })
      .select()
      .single()

    if (error || !data) return null
    this.items = [data, ...this.items]
    this.syncStatus = 'saved'
    this.lastSyncedAt = new Date()
    this._notify()
    return data
  },

  updateNote(noteId, fields) {
    this.items = this.items.map((n) =>
      n.id === noteId ? { ...n, ...fields, updated_at: new Date().toISOString() } : n
    )
    this._notify()
    this._scheduleSave(noteId, fields)
  },

  // Soft delete: moves the note to Trash, where it stays for 60 days.
  async deleteNote(noteId) {
    const timer = this._timers.get(noteId)
    if (timer) clearTimeout(timer)
    this._timers.delete(noteId)
    this._pending.delete(noteId)

    const note = this.items.find((n) => n.id === noteId)
    this.items = this.items.filter((n) => n.id !== noteId)

    const deletedAt = new Date().toISOString()
    if (note) this.trashItems = [{ ...note, is_deleted: true, deleted_at: deletedAt }, ...this.trashItems]
    this._notify()

    const { error } = await db
      .from('notes')
      .update({ is_deleted: true, deleted_at: deletedAt })
      .eq('id', noteId)

    if (error) {
      console.error('Failed to move note to trash:', error)
      // Roll back — the delete didn't actually happen, so put it back.
      this.trashItems = this.trashItems.filter((n) => n.id !== noteId)
      if (note) this.items = [note, ...this.items]
      this._notify()
      alert(
        "Couldn't move that note to Trash (" +
          error.message +
          "). If you added the Trash feature after first setting up Supabase, make sure you've re-run the latest supabase/schema.sql in the SQL Editor."
      )
    }
  },

  // Brings a note back out of Trash.
  async restoreNote(noteId) {
    const note = this.trashItems.find((n) => n.id === noteId)
    this.trashItems = this.trashItems.filter((n) => n.id !== noteId)
    if (note) {
      this.items = [{ ...note, is_deleted: false, deleted_at: null }, ...this.items].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return new Date(b.updated_at) - new Date(a.updated_at)
      })
    }
    this._notify()

    const { error } = await db.from('notes').update({ is_deleted: false, deleted_at: null }).eq('id', noteId)

    if (error) {
      console.error('Failed to restore note:', error)
      this.items = this.items.filter((n) => n.id !== noteId)
      if (note) this.trashItems = [note, ...this.trashItems]
      this._notify()
      alert("Couldn't restore that note (" + error.message + ').')
    }
  },

  // Deletes a note for good — no more recovery after this.
  async deleteForever(noteId) {
    const note = this.trashItems.find((n) => n.id === noteId)
    this.trashItems = this.trashItems.filter((n) => n.id !== noteId)
    this._notify()

    const { error } = await db.from('notes').delete().eq('id', noteId)

    if (error) {
      console.error('Failed to permanently delete note:', error)
      if (note) this.trashItems = [note, ...this.trashItems]
      this._notify()
      alert("Couldn't permanently delete that note (" + error.message + ').')
    }
  },

  async emptyTrash(userId) {
    const previousTrash = this.trashItems
    this.trashItems = []
    this._notify()

    if (previousTrash.length) {
      const { error } = await db.from('notes').delete().eq('user_id', userId).eq('is_deleted', true)

      if (error) {
        console.error('Failed to empty trash:', error)
        this.trashItems = previousTrash
        this._notify()
        alert("Couldn't empty Trash (" + error.message + ').')
      }
    }
  },

  async togglePin(noteId, pinned) {
    this.items = this.items
      .map((n) => (n.id === noteId ? { ...n, pinned } : n))
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return new Date(b.updated_at) - new Date(a.updated_at)
      })
    this._notify()
    const { error } = await db.from('notes').update({ pinned }).eq('id', noteId)
    if (error) console.error('Failed to update pin:', error)
  },

  get(noteId) {
    return this.items.find((n) => n.id === noteId)
  },

  // Bulk-imports notes from an array of {title, body, pinned?, updated_at?}
  // objects (used by the Settings → Import Notes feature). Inserts in small
  // batches and reports progress via onProgress(done, total).
  async importNotes(userId, notesArray, onProgress) {
    const BATCH_SIZE = 25
    let done = 0

    for (let i = 0; i < notesArray.length; i += BATCH_SIZE) {
      const batch = notesArray.slice(i, i + BATCH_SIZE).map((n) => {
        const timestamp = n.updated_at || new Date().toISOString()
        return {
          user_id: userId,
          title: (n.title || '').toString(),
          body: (n.body || '').toString(),
          pinned: !!n.pinned,
          created_at: timestamp,
          updated_at: timestamp,
        }
      })

      const { data, error } = await db.from('notes').insert(batch).select()
      if (error) throw error

      if (data) this.items = [...data, ...this.items]
      done += batch.length
      if (onProgress) onProgress(done, notesArray.length)
      this._notify()
    }

    this.items.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return new Date(b.updated_at) - new Date(a.updated_at)
    })
    this._notify()
  },

  daysRemaining(note) {
    if (!note.deleted_at) return TRASH_RETENTION_DAYS
    const deletedAt = new Date(note.deleted_at)
    const expiresAt = new Date(deletedAt)
    expiresAt.setDate(expiresAt.getDate() + TRASH_RETENTION_DAYS)
    const msLeft = expiresAt - new Date()
    return Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)))
  },
}

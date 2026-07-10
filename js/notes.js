const AUTOSAVE_DELAY_MS = 700

const Notes = {
  items: [],
  loading: true,
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

  async deleteNote(noteId) {
    const timer = this._timers.get(noteId)
    if (timer) clearTimeout(timer)
    this._timers.delete(noteId)
    this._pending.delete(noteId)

    this.items = this.items.filter((n) => n.id !== noteId)
    this._notify()
    await db.from('notes').update({ is_deleted: true }).eq('id', noteId)
  },

  async togglePin(noteId, pinned) {
    this.items = this.items
      .map((n) => (n.id === noteId ? { ...n, pinned } : n))
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return new Date(b.updated_at) - new Date(a.updated_at)
      })
    this._notify()
    await db.from('notes').update({ pinned }).eq('id', noteId)
  },

  get(noteId) {
    return this.items.find((n) => n.id === noteId)
  },
}

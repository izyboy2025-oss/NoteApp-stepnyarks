const Auth = {
  session: undefined, // undefined = loading, null = signed out, object = signed in
  listeners: [],

  onChange(fn) {
    this.listeners.push(fn)
    return () => {
      this.listeners = this.listeners.filter((f) => f !== fn)
    }
  },

  _notify() {
    this.listeners.forEach((fn) => fn(this.session))
  },

  async init() {
    const { data } = await db.auth.getSession()
    this.session = data.session
    this._notify()

    db.auth.onAuthStateChange((_event, newSession) => {
      this.session = newSession
      this._notify()
    })
  },

  get user() {
    return this.session ? this.session.user : null
  },

  async signInWithGoogle() {
    const { error } = await db.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    })
    if (error) throw error
  },

  async signInWithPassword(email, password) {
    const { error } = await db.auth.signInWithPassword({ email, password })
    if (error) throw error
  },

  async signUpWithPassword(email, password) {
    const { error } = await db.auth.signUp({ email, password })
    if (error) throw error
  },

  async sendPasswordReset(email) {
    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname,
    })
    if (error) throw error
  },

  async setNewPassword(password) {
    const { error } = await db.auth.updateUser({ password })
    if (error) throw error
  },

  async signOut() {
    await db.auth.signOut()
  },
}

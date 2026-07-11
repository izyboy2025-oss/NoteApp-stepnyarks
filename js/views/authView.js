function renderAuthView(root) {
  let mode = 'signin' // 'signin' | 'signup'

  root.innerHTML = `
    <div class="auth-screen">
      <div class="auth-brand">
        <div class="auth-logo">${Icon.file}</div>
        <div class="auth-title">Notes</div>
        <div class="auth-subtitle">Signed in once, backed up always.</div>
      </div>

      <button class="btn btn-dark btn-icon" id="google-btn">${Icon.globe} Continue with Google</button>

      <div class="divider"><span>or use a password</span></div>

      <form id="auth-form">
        <div class="field-row">
          ${Icon.mail}
          <input type="email" id="email" required placeholder="Email" autocomplete="email" />
        </div>
        <div class="field-row">
          ${Icon.key}
          <input type="password" id="password" required placeholder="Password" autocomplete="current-password" />
        </div>
        <div class="form-msg" id="auth-error" style="color:var(--danger)"></div>
        <div class="form-msg" id="auth-info" style="color:var(--success)"></div>
        <button type="submit" class="btn btn-accent" id="submit-btn" style="margin-top:16px">Sign In</button>
      </form>

      <div class="auth-footer">
        <button class="link-btn" id="toggle-mode">Create an account</button>
        <button class="link-btn muted" id="forgot-btn">Forgot password?</button>
      </div>
    </div>
  `

  const errorEl = root.querySelector('#auth-error')
  const infoEl = root.querySelector('#auth-info')
  const submitBtn = root.querySelector('#submit-btn')
  const toggleBtn = root.querySelector('#toggle-mode')
  const forgotBtn = root.querySelector('#forgot-btn')

  function setMsg(err, info) {
    errorEl.textContent = err || ''
    infoEl.textContent = info || ''
  }

  root.querySelector('#google-btn').onclick = async () => {
    setMsg('')
    try {
      await Auth.signInWithGoogle()
    } catch (e) {
      setMsg(e.message || 'Could not start Google sign-in.')
    }
  }

  toggleBtn.onclick = () => {
    mode = mode === 'signin' ? 'signup' : 'signin'
    submitBtn.textContent = mode === 'signin' ? 'Sign In' : 'Create Account'
    toggleBtn.textContent = mode === 'signin' ? 'Create an account' : 'Have an account? Sign in'
    forgotBtn.style.display = mode === 'signin' ? 'inline' : 'none'
    setMsg('')
  }

  forgotBtn.onclick = async () => {
    const email = root.querySelector('#email').value
    setMsg('')
    if (!email) {
      setMsg('Enter your email above first.')
      return
    }
    try {
      await Auth.sendPasswordReset(email)
      setMsg('', 'Password reset email sent.')
    } catch (e) {
      setMsg(e.message || 'Could not send reset email.')
    }
  }

  root.querySelector('#auth-form').onsubmit = async (e) => {
    e.preventDefault()
    setMsg('')
    const email = root.querySelector('#email').value
    const password = root.querySelector('#password').value
    submitBtn.disabled = true
    try {
      if (mode === 'signin') {
        await Auth.signInWithPassword(email, password)
      } else {
        await Auth.signUpWithPassword(email, password)
        setMsg('', 'Check your email to confirm your account, then sign in.')
      }
    } catch (e2) {
      setMsg(e2.message || 'Something went wrong.')
    } finally {
      submitBtn.disabled = false
    }
  }
}

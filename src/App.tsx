import { useDeferredValue, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createPost, deletePost, fetchComments, fetchPosts, updatePost } from './api'
import './App.css'
import type { Comment, Post, PostDraft } from './types'
 
type AuthUser = {
  name: string
  email: string
}
 
type StoredAuthUser = AuthUser & {
  password: string
}
 
type AuthMode = 'sign-in' | 'sign-up'

const POSTS_CACHE_KEY = 'jsonplaceholder.posts.cache.v1'
const COMMENTS_CACHE_KEY = 'jsonplaceholder.comments.cache.v1'
const AUTH_USERS_KEY = 'jsonplaceholder.auth.users.v1'
const AUTH_SESSION_KEY = 'jsonplaceholder.auth.session.v1'
const PAGE_SIZE = 8

const EMPTY_DRAFT: PostDraft = {
  userId: 1,
  title: '',
  body: '',
}

function safeLoad<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const raw = window.localStorage.getItem(key)

    if (!raw) {
      return fallback
    }

    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function safeSave<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage failures and keep the UI working.
  }
}

function safeLoadSession<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const raw = window.sessionStorage.getItem(key)

    if (!raw) {
      return fallback
    }

    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function safeSaveSession<T>(key: string, value: T) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage failures and keep the UI working.
  }
}

function sortPosts(posts: Post[]) {
  return [...posts].sort((left, right) => right.id - left.id)
}

function excerpt(body: string) {
  return body.length > 120 ? `${body.slice(0, 117)}...` : body
}
 
function seedAuthUsers(): StoredAuthUser[] {
  return [
    {
      name: 'Demo Interview User',
      email: 'demo@copilot.dev',
      password: 'password123',
    },
  ]
}

function App() {
  const [authUsers, setAuthUsers] = useState<StoredAuthUser[]>(() =>
    safeLoad<StoredAuthUser[]>(AUTH_USERS_KEY, seedAuthUsers()),
  )
  const [authUser, setAuthUser] = useState<AuthUser | null>(() =>
    safeLoad<AuthUser | null>(AUTH_SESSION_KEY, null),
  )
  const [authMode, setAuthMode] = useState<AuthMode>('sign-in')
  const [authName, setAuthName] = useState('')
  const [authEmail, setAuthEmail] = useState('demo@copilot.dev')
  const [authPassword, setAuthPassword] = useState('password123')
  const [authConfirmPassword, setAuthConfirmPassword] = useState('password123')
  const [authMessage, setAuthMessage] = useState<string | null>(null)
  const [posts, setPosts] = useState<Post[]>(() => sortPosts(safeLoad<Post[]>(POSTS_CACHE_KEY, [])))
  const [commentsCache, setCommentsCache] = useState<Record<number, Comment[]>>(() =>
    safeLoadSession<Record<number, Comment[]>>(COMMENTS_CACHE_KEY, {}),
  )
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null)
  const [draft, setDraft] = useState<PostDraft>(EMPTY_DRAFT)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [initialLoading, setInitialLoading] = useState(posts.length === 0)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [commentStatus, setCommentStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const deferredSearch = useDeferredValue(search)
 
  useEffect(() => {
    safeSave(AUTH_USERS_KEY, authUsers)
  }, [authUsers])
 
  useEffect(() => {
    safeSave(AUTH_SESSION_KEY, authUser)
  }, [authUser])

  useEffect(() => {
    safeSave(POSTS_CACHE_KEY, posts)
  }, [posts])

  useEffect(() => {
    safeSaveSession(COMMENTS_CACHE_KEY, commentsCache)
  }, [commentsCache])

  useEffect(() => {
    let cancelled = false
 
    if (!authUser) {
      return
    }

    async function bootstrap() {
      if (posts.length > 0) {
        setInitialLoading(false)
        return
      }

      setInitialLoading(true)
      setError(null)

      try {
        const fresh = sortPosts(await fetchPosts())

        if (cancelled) {
          return
        }

        setPosts(fresh)
        setNotice('Loaded the latest posts from JSONPlaceholder.')
      } catch (requestError) {
        if (cancelled) {
          return
        }

        setError(requestError instanceof Error ? requestError.message : 'Failed to load posts')
      } finally {
        if (!cancelled) {
          setInitialLoading(false)
        }
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [authUser, posts.length])

  function resetAuthForm(mode: AuthMode = 'sign-in') {
    setAuthMode(mode)
    setAuthName('')
    setAuthEmail(mode === 'sign-in' ? 'demo@copilot.dev' : '')
    setAuthPassword(mode === 'sign-in' ? 'password123' : '')
    setAuthConfirmPassword(mode === 'sign-in' ? 'password123' : '')
    setAuthMessage(null)
  }

  function handleLogout() {
    setAuthUser(null)
    setNotice(null)
    setError(null)
    setSearch('')
    setPage(1)
    setSelectedPostId(null)
    setDraft(EMPTY_DRAFT)
    setCommentStatus('idle')
    resetAuthForm('sign-in')
  }

  function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const email = authEmail.trim().toLowerCase()
    const password = authPassword.trim()
    const name = authName.trim()

    if (!email || !password) {
      setAuthMessage('Email and password are required.')
      return
    }

    if (authMode === 'sign-up' && !name) {
      setAuthMessage('Name is required when creating a new account.')
      return
    }

    if (authMode === 'sign-up' && password !== authConfirmPassword.trim()) {
      setAuthMessage('Passwords do not match.')
      return
    }

    const existingUser = authUsers.find((user) => user.email === email)

    if (authMode === 'sign-up') {
      if (existingUser) {
        setAuthMessage('An account with that email already exists.')
        return
      }

      const nextUser: StoredAuthUser = { name, email, password }

      setAuthUsers((current) => [...current, nextUser])
      setAuthUser({ name, email })
      setAuthMessage('Account created. You are now signed in.')
      return
    }

    if (!existingUser || existingUser.password !== password) {
      setAuthMessage('Invalid email or password.')
      return
    }

    setAuthUser({ name: existingUser.name, email: existingUser.email })
    setAuthMessage('Signed in successfully.')
  }

  if (!authUser) {
    return (
      <main className="app-shell auth-shell">
        <section className="auth-panel">
          <div className="auth-copy">
            <p className="eyebrow">In-app authentication</p>
            <h1>Sign in to unlock the JSONPlaceholder CRUD studio.</h1>
            <p className="lede">
              This interview build uses local in-app authentication with a persisted demo account and
              sign-up flow. Once signed in, the full CRUD dashboard, pagination, caching, and comment
              viewer become available.
            </p>

            <div className="auth-note">
              <strong>Demo credentials</strong>
              <span>demo@copilot.dev / password123</span>
            </div>
          </div>

          <form className="auth-form" onSubmit={handleAuthSubmit}>
            <div className="auth-switch">
              <button
                type="button"
                className={authMode === 'sign-in' ? 'auth-tab is-active' : 'auth-tab'}
                onClick={() => resetAuthForm('sign-in')}
              >
                Sign in
              </button>
              <button
                type="button"
                className={authMode === 'sign-up' ? 'auth-tab is-active' : 'auth-tab'}
                onClick={() => resetAuthForm('sign-up')}
              >
                Sign up
              </button>
            </div>

            {authMode === 'sign-up' ? (
              <label>
                <span>Name</span>
                <input
                  value={authName}
                  onChange={(event) => setAuthName(event.target.value)}
                  placeholder="Your name"
                />
              </label>
            ) : null}

            <label>
              <span>Email</span>
              <input
                type="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>

            <label>
              <span>Password</span>
              <input
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                placeholder="Enter your password"
              />
            </label>

            {authMode === 'sign-up' ? (
              <label>
                <span>Confirm password</span>
                <input
                  type="password"
                  value={authConfirmPassword}
                  onChange={(event) => setAuthConfirmPassword(event.target.value)}
                  placeholder="Confirm your password"
                />
              </label>
            ) : null}

            {authMessage ? <p className="status status--error">{authMessage}</p> : null}

            <button type="submit" className="primary-button auth-submit">
              {authMode === 'sign-in' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </section>
      </main>
    )
  }

  const normalizedSearch = deferredSearch.trim().toLowerCase()
  const filteredPosts = normalizedSearch
    ? posts.filter((post) => {
        const searchable = `${post.title} ${post.body} ${post.userId}`.toLowerCase()

        return searchable.includes(normalizedSearch)
      })
    : posts

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visiblePosts = filteredPosts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? null
  const selectedComments = selectedPostId ? commentsCache[selectedPostId] ?? [] : []

  async function loadCommentsForPost(postId: number) {
    const cachedComments = commentsCache[postId]

    if (cachedComments) {
      setCommentStatus('ready')
      return cachedComments
    }

    setCommentStatus('loading')

    try {
      const freshComments = await fetchComments(postId)

      setCommentsCache((current) => ({
        ...current,
        [postId]: freshComments,
      }))
      setCommentStatus('ready')

      return freshComments
    } catch {
      setCommentStatus('error')
      return []
    }
  }

  function beginCreate() {
    setSelectedPostId(null)
    setDraft(EMPTY_DRAFT)
    setCommentStatus('idle')
    setNotice('Ready for a new post.')
  }

  function choosePost(post: Post) {
    setSelectedPostId(post.id)
    setDraft({ userId: post.userId, title: post.title, body: post.body })
    setNotice(`Loaded post #${post.id}.`)
    void loadCommentsForPost(post.id)
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const title = draft.title.trim()
    const body = draft.body.trim()

    if (!title || !body) {
      setError('Title and body are required.')
      return
    }

    setError(null)
    setIsSaving(true)

    const payload: PostDraft = {
      userId: Number.isFinite(draft.userId) && draft.userId > 0 ? draft.userId : 1,
      title,
      body,
    }

    try {
      if (selectedPostId === null) {
        const optimisticPost: Post = {
          id: Date.now(),
          ...payload,
        }

        setPosts((current) => sortPosts([optimisticPost, ...current]))
        setSelectedPostId(optimisticPost.id)
        setNotice('Creating post...')

        await createPost(payload)
        void loadCommentsForPost(optimisticPost.id)

        setNotice(`Created post #${optimisticPost.id}.`)
      } else {
        const optimisticPost: Post = {
          id: selectedPostId,
          ...payload,
        }

        setPosts((current) =>
          sortPosts(current.map((post) => (post.id === selectedPostId ? optimisticPost : post))),
        )
        setNotice(`Saving post #${selectedPostId}...`)

        await updatePost(selectedPostId, payload)

        setNotice(`Saved post #${selectedPostId}.`)
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to save post')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (selectedPostId === null) {
      return
    }

    const confirmed = window.confirm('Delete this post from the demo state?')

    if (!confirmed) {
      return
    }

    setError(null)
    setIsDeleting(true)

    const currentId = selectedPostId
    const snapshot = posts

    try {
      setPosts((current) => current.filter((post) => post.id !== currentId))
      await deletePost(currentId)
      setCommentsCache((current) => {
        const next = { ...current }

        delete next[currentId]

        return next
      })

      const nextVisible = snapshot.filter((post) => post.id !== currentId)
      const fallbackPost = nextVisible[0] ?? null

      if (fallbackPost) {
        choosePost(fallbackPost)
      } else {
        beginCreate()
      }

      setNotice(`Deleted post #${currentId}.`)
    } catch (requestError) {
      setPosts(snapshot)
      setError(requestError instanceof Error ? requestError.message : 'Failed to delete post')
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleResetCache() {
    const confirmed = window.confirm('Clear the local cache and reload JSONPlaceholder?')

    if (!confirmed) {
      return
    }

    window.localStorage.removeItem(POSTS_CACHE_KEY)
    window.sessionStorage.removeItem(COMMENTS_CACHE_KEY)

    setCommentsCache({})
    setSelectedPostId(null)
    setDraft(EMPTY_DRAFT)
    setPage(1)
    setNotice('Cache cleared. Reloading from JSONPlaceholder...')

    try {
      setInitialLoading(true)
      const fresh = sortPosts(await fetchPosts())

      setPosts(fresh)
      setNotice('Cache reset and baseline restored.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to restore baseline')
    } finally {
      setInitialLoading(false)
    }
  }

  function pageDelta(delta: number) {
    setPage((current) => Math.min(totalPages, Math.max(1, current + delta)))
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">JSONPlaceholder CRUD studio</p>
          <h1>Fast post management with optimistic edits, caching, and responsive layout.</h1>
          <p className="lede">
            Signed in as {authUser.name} ({authUser.email}). This SPA consumes the JSONPlaceholder
            API, caches data locally for faster reloads, and keeps the UI reactive while you create,
            update, delete, filter, and inspect posts.
          </p>

          <div className="hero-actions">
            <button type="button" className="primary-button" onClick={beginCreate}>
              New post
            </button>
            <button type="button" className="secondary-button" onClick={handleResetCache}>
              Reset cache
            </button>
          </div>
        </div>

        <div className="hero-metrics" aria-label="Summary metrics">
          <article>
            <span>Total posts</span>
            <strong>{posts.length}</strong>
          </article>
          <article>
            <span>Visible now</span>
            <strong>{visiblePosts.length}</strong>
          </article>
          <article>
            <span>Comments cached</span>
            <strong>{Object.keys(commentsCache).length}</strong>
          </article>
        </div>
      </section>

      <section className="toolbar" aria-label="Controls">
        <label className="search-field">
          <span>Search posts</span>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Try a title, body phrase, or user id"
          />
        </label>

        <div className="toolbar-actions">
          <button type="button" className="ghost-button" onClick={() => pageDelta(-1)}>
            Previous
          </button>
          <button type="button" className="ghost-button" onClick={() => pageDelta(1)}>
            Next
          </button>
          <div className="page-pill">
            Page {currentPage} of {totalPages}
          </div>
              <div className="user-chip" aria-label="Signed-in user">
                <span>{authUser.name}</span>
                <button type="button" className="ghost-button" onClick={handleLogout}>
                  Log out
                </button>
              </div>
        </div>
      </section>

      {notice ? <p className="status status--success">{notice}</p> : null}
      {error ? <p className="status status--error">{error}</p> : null}

      <section className="workspace">
        <aside className="panel panel--list">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">Browse</p>
              <h2>Posts</h2>
            </div>
            <span className="panel-subtitle">{filteredPosts.length} matches</span>
          </div>

          <div className="post-list">
            {initialLoading ? (
              <div className="skeleton-grid" aria-hidden="true">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div className="skeleton-card" key={index} />
                ))}
              </div>
            ) : visiblePosts.length === 0 ? (
              <div className="empty-state">
                <h3>No posts found</h3>
                <p>Try a different search or create a new post.</p>
              </div>
            ) : (
              visiblePosts.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  className={`post-card ${selectedPostId === post.id ? 'is-active' : ''}`}
                  onClick={() => choosePost(post)}
                >
                  <span className="post-card__meta">
                    <strong>#{post.id}</strong>
                    <em>User {post.userId}</em>
                  </span>
                  <h3>{post.title}</h3>
                  <p>{excerpt(post.body)}</p>
                </button>
              ))
            )}
          </div>

          <div className="pager">
            <button type="button" className="ghost-button" onClick={() => pageDelta(-1)}>
              Previous page
            </button>
            <button type="button" className="ghost-button" onClick={() => pageDelta(1)}>
              Next page
            </button>
          </div>
        </aside>

        <section className="panel panel--editor">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">Compose</p>
              <h2>{selectedPost ? `Editing #${selectedPost.id}` : 'Create a post'}</h2>
            </div>
            <span className="panel-subtitle">Optimistic save enabled</span>
          </div>

          <form className="editor-form" onSubmit={handleSave}>
            <label>
              <span>User id</span>
              <input
                type="number"
                min="1"
                value={draft.userId}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, userId: Number(event.target.value) }))
                }
              />
            </label>

            <label>
              <span>Title</span>
              <input
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="Write a concise title"
              />
            </label>

            <label>
              <span>Body</span>
              <textarea
                rows={10}
                value={draft.body}
                onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
                placeholder="Write the post content"
              />
            </label>

            <div className="editor-actions">
              <button type="submit" className="primary-button" disabled={isSaving}>
                {isSaving ? 'Saving...' : selectedPost ? 'Save changes' : 'Create post'}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={beginCreate}
                disabled={isSaving}
              >
                Clear form
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={handleDelete}
                disabled={selectedPostId === null || isDeleting || isSaving}
              >
                {isDeleting ? 'Deleting...' : 'Delete post'}
              </button>
            </div>
          </form>

          <article className="detail-card">
            <div className="detail-card__header">
              <div>
                <p className="panel-kicker">Preview</p>
                <h3>{selectedPost ? selectedPost.title : 'Unsaved draft'}</h3>
              </div>
              {selectedPost ? <span className="status-chip">User {selectedPost.userId}</span> : null}
            </div>
            <p>{selectedPost ? selectedPost.body : 'Your draft will appear here as soon as you save it.'}</p>
          </article>
        </section>

        <aside className="panel panel--comments">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">Commenting</p>
              <h2>Post activity</h2>
            </div>
            <span className="panel-subtitle">
              {selectedPost ? `#${selectedPost.id}` : 'No post selected'}
            </span>
          </div>

          {selectedPost ? (
            <div className="comments-list">
              {commentStatus === 'loading' ? (
                <div className="empty-state compact">
                  <h3>Loading comments</h3>
                  <p>The first fetch is cached so the next selection is instant.</p>
                </div>
              ) : commentStatus === 'error' ? (
                <div className="empty-state compact">
                  <h3>Comments unavailable</h3>
                  <p>JSONPlaceholder did not return a comment payload for this post.</p>
                </div>
              ) : selectedComments.length === 0 ? (
                <div className="empty-state compact">
                  <h3>No comments cached yet</h3>
                  <p>Select another post to load and cache its comments.</p>
                </div>
              ) : (
                selectedComments.map((comment) => (
                  <article className="comment-card" key={comment.id}>
                    <div className="comment-card__header">
                      <strong>{comment.name}</strong>
                      <span>{comment.email}</span>
                    </div>
                    <p>{comment.body}</p>
                  </article>
                ))
              )}
            </div>
          ) : (
            <div className="empty-state compact">
              <h3>Create or select a post</h3>
              <p>The right panel will fetch comments and reuse the cached response after the first load.</p>
            </div>
          )}
        </aside>
      </section>
    </main>
  )
}

export default App
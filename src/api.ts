import type { Comment, Post, PostDraft } from './types'

const API_ROOT = 'https://jsonplaceholder.typicode.com'

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }

  const text = await response.text()

  if (!text) {
    return undefined as T
  }

  return JSON.parse(text) as T
}

export async function fetchPosts(): Promise<Post[]> {
  return requestJson<Post[]>('/posts')
}

export async function fetchComments(postId: number): Promise<Comment[]> {
  return requestJson<Comment[]>(`/comments?postId=${postId}`)
}

export async function createPost(draft: PostDraft): Promise<Post> {
  return requestJson<Post>('/posts', {
    method: 'POST',
    body: JSON.stringify(draft),
  })
}

export async function updatePost(postId: number, draft: PostDraft): Promise<Post> {
  return requestJson<Post>(`/posts/${postId}`, {
    method: 'PATCH',
    body: JSON.stringify(draft),
  })
}

export async function deletePost(postId: number): Promise<void> {
  await requestJson(`/posts/${postId}`, {
    method: 'DELETE',
  })
}

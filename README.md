# JSONPlaceholder CRUD Studio

Single-page React + TypeScript app that consumes the JSONPlaceholder API and demonstrates full CRUD on posts.

## What it covers

- Create, retrieve, update, and delete posts through the JSONPlaceholder API.
- Responsive SPA layout for desktop and mobile.
- Optimistic UI updates with client-side caching to reduce perceived latency.
- Pagination, search, and lightweight local/session caching for faster navigation.
- In-app authentication with a persisted demo account and sign-up flow.
- Comment viewing for selected posts as a bonus interaction.
- Subtle transitions, skeleton loading, and card motion for a more polished UI.

## Bonus features included

The prompt says these are not required, but this implementation includes them as extras:

- In-app authentication.
- Commenting panel for selected posts.
- Transition and animation effects.
- Cached post comments to reduce repeat fetches.

## Stack

- React 19
- TypeScript
- Vite

## Run locally

```bash
npm install
npm run dev
```

## Verify

- `npm run lint`
- `npm run build`

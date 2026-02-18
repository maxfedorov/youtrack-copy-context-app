# Copy Context App

Copy issue context to Markdown from YouTrack issue page.

## Features
- One-click copy of selected issue context pieces as Markdown
- Choose what to include: id, reporter, created, project, summary, description, tags, fields, attachments, links, comments
- Remembers your selection per user

## How it works
- The widget appears in Issue options menu
- When opened, the app loads issue data via YouTrack REST and user settings via app backend
- On "Copy", settings are saved and the Markdown is copied to clipboard, then the widget closes

## REST requests (on open)
1. Issue data `GET /api/issues/{issueId}?fields=...`
2. Issue links `GET /api/issues/{issueId}/links?fields=...`
3. Issue activities for comments `GET /api/issues/{issueId}/activitiesPage?categories=...&fields=...`

## Backend endpoints
- `GET backend-global/user-settings` — read current user's checkbox settings
- `POST backend-global/user-settings` — persist current user's checkbox settings (stored in global storage namespaced by user id)

## Clipboard
The widget uses a fallback copy method (hidden textarea + `document.execCommand('copy')`) because the standard Clipboard API is not available in YouTrack widget iframes.

## Defensive behavior
- Missing fields are skipped silently
- Unsupported/failed items (attachments, fields) are ignored instead of failing the entire operation

## Development
- Build: `npm run build`
- Lint: `npm run lint`


# Copy Context and Link App

Copy issue and article context or a configurable Markdown link to your clipboard.

## Features
- **Copy context**: One-click copy of selected context pieces as Markdown (Issue and Article).
- **Copy Markdown Link**: A separate widget to copy the current entity as a Markdown link using a custom template.
- Works for both Issues and Articles.
- Granular options per section for context:
  - Issue: ID, Summary, Description, Project, Reporter, Created, Tags, Fields, Attachments, Links, Comments.
  - Article: ID, Summary, Content, Project, Reporter, Created, Tags, Attachments, Comments.
- **Custom Template**: Configure the Markdown link template in the app settings on the project settings page.
- Remembers your context selection per user (stored in the `User` entity).

## How it works
- Four widgets are available via the Options menu:
  - `ISSUE_OPTIONS_MENU_ITEM` (Context and Markdown Link)
  - `ARTICLE_OPTIONS_MENU_ITEM` (Context and Markdown Link)
- On open, the context widget loads entity data via YouTrack REST and reads per‑user settings via app backend.
- The Markdown Link widget uses a configurable template from the app's global storage.
- On "Copy", the app saves the current checkbox configuration, copies the generated Markdown to clipboard, and closes the widget.

## REST requests (on open)
Issue widget:
1. `GET /api/issues/{id}?fields=id,idReadable,summary,description,reporter(login,fullName),created,project(shortName,name),tags(name),attachments(id,name,url,size,mimeType,created,author(login,fullName)),fields(value(id,name,login,fullName,localizedName,presentation,$type),projectCustomField(field(name,fieldType(valueType))))`
2. `GET /api/issues/{id}/links?fields=direction,linkType(name,localizedName,sourceToTarget,localizedSourceToTarget,targetToSource,localizedTargetToSource),issues(idReadable,summary)`
3. `GET /api/issues/{id}/activitiesPage?categories=...&fields=activities(author(login,fullName),timestamp,category(id),added(text,$type),removed(text,$type))`

Article widget:
1. `GET /api/articles/{id}?fields=id,idReadable,summary,content,reporter(login,fullName),created,project(shortName,name),tags(name),attachments(id,name,url,size,mimeType,created,author(login,fullName))`
2. `GET /api/articles/{id}/activitiesPage?categories=...&fields=activities(author(login,fullName),timestamp,category(id),added(text,$type),removed(text,$type))`

## User settings storage
- Stored in `ctx.currentUser.extensionProperties.copyContextSettings` (stringified JSON)
- Endpoints (global backend):
  - `GET backend-global/user-settings` — read
  - `POST backend-global/user-settings` — write

## Installation

### Manually

1. `npm install`
2. `npm run build`
3. Archive "dist" folder into a single ZIP file
4. Go to `/admin/apps` and import app from ZIP archive
5. Select desired projects on projects tab in the app sidebar

### With CLI

1. `npm install`
2. `npm run build && npm run upload -- --host %YOUTRACK_URL% --token %PERMANENT_USER_TOKEN%`
3. Select desired projects on the apps page


# Generated Route and Permission Catalog

이 파일은 `npm run docs:routes`로 생성한다. 직접 편집하지 않는다.

## Routes

| route id | method | path | auth | permission/policy | demo access |
|---|---|---|---|---|---|
| `assets.generated` | `*` | `/assets/:path*` | public | public | `blocked` |
| `assets.images` | `*` | `/images/:path*` | public | public | `blocked` |
| `assets.favicon` | `*` | `/favicon.ico` | public | public | `blocked` |
| `health.read` | `GET` | `/healthz` | public | public | `screen` |
| `readiness.read` | `GET` | `/readyz` | public | public | `screen` |
| `session.login.form` | `GET` | `/login` | public | public | `screen` |
| `session.login` | `POST` | `/login` | public | public | `blocked` |
| `session.signup.blocked` | `*` | `/signup` | public | policy:always-404 | `blocked` |
| `home.redirect` | `GET` | `/` | required | authenticated | `screen` |
| `search.home` | `GET` | `/app` | required | authenticated | `screen` |
| `floor-plan.read` | `GET` | `/floor-plan` | required | authenticated | `screen` |
| `qa.read` | `GET` | `/qa` | required | authenticated | `screen` |
| `search.suggestions` | `GET` | `/api/search-suggestions` | required | authenticated | `interactive-read` |
| `search.viewer` | `GET` | `/api/viewer/search` | required | authenticated | `interactive-read` |
| `search.index` | `GET` | `/api/search-index` | required | authenticated | `blocked` |
| `search.click` | `POST` | `/api/search-click` | required | authenticated | `blocked` |
| `session.password.form` | `GET` | `/account/password` | required | authenticated | `screen` |
| `session.password.change` | `POST` | `/account/password` | required | authenticated | `forced-password` |
| `session.logout` | `POST` | `/logout` | required | authenticated | `logout` |
| `session.logout.fallback` | `*` | `/logout` | required | authenticated | `blocked` |
| `admin.dashboard` | `GET` | `/admin` | required | policy:any-management-permission | `screen` |
| `admin.settings` | `GET` | `/admin/settings` | required | `can_manage_users` | `screen` |
| `admin.user.create.form` | `GET` | `/admin/users/new` | required | `can_manage_users` + policy:admin-only | `screen` |
| `admin.user.create` | `POST` | `/admin/users/new` | required | `can_manage_users` + policy:admin-only | `blocked` |
| `admin.role-templates` | `GET` | `/admin/role-templates` | required | `can_manage_users` + policy:admin-only | `screen` |
| `admin.role-template.edit.form` | `GET` | `/admin/role-templates/:key/edit` | required | `can_manage_users` + policy:admin-only | `screen` |
| `admin.role-template.edit` | `POST` | `/admin/role-templates/:key/edit` | required | `can_manage_users` + policy:admin-only | `blocked` |
| `admin.role-template.apply` | `POST` | `/admin/role-templates/:key/apply` | required | `can_manage_users` + policy:admin-only | `blocked` |
| `admin.search-report` | `GET` | `/admin/search-report` | required | `can_view_audit` | `screen` |
| `admin.audit` | `GET` | `/admin/audit` | required | `can_view_audit` | `screen` |
| `admin.movements` | `GET` | `/admin/movements` | required | policy:move-or-audit | `screen` |
| `admin.data-quality` | `GET` | `/admin/data-quality` | required | `can_manage_documents` | `screen` |
| `admin.user.permissions.form` | `GET` | `/admin/users/:id/permissions` | required | `can_manage_users` | `screen` |
| `admin.user.permissions` | `POST` | `/admin/users/:id/permissions` | required | `can_manage_users` | `blocked` |
| `admin.user.password-reset.form` | `GET` | `/admin/users/:id/reset-password` | required | `can_manage_users` + policy:admin-only | `screen` |
| `admin.user.password-reset` | `POST` | `/admin/users/:id/reset-password` | required | `can_manage_users` + policy:admin-only | `blocked` |
| `admin.user.delete.form` | `GET` | `/admin/users/:id/delete` | required | `can_manage_users` + policy:admin-only | `screen` |
| `admin.user.delete` | `POST` | `/admin/users/:id/delete` | required | `can_manage_users` + policy:admin-only | `blocked` |
| `admin.user.approve` | `POST` | `/admin/users/:id/approve` | required | `can_manage_users` | `blocked` |
| `admin.user.reject` | `POST` | `/admin/users/:id/reject` | required | `can_manage_users` | `blocked` |
| `admin.user.disable` | `POST` | `/admin/users/:id/disable` | required | `can_manage_users` | `blocked` |
| `admin.user.enable` | `POST` | `/admin/users/:id/enable` | required | `can_manage_users` | `blocked` |
| `documents.duplicate` | `GET` | `/api/documents/duplicate` | required | `can_manage_documents` | `blocked` |
| `documents.list` | `GET` | `/documents` | required | authenticated | `screen` |
| `documents.create` | `POST` | `/documents` | required | `can_manage_documents` | `blocked` |
| `documents.disposal` | `GET` | `/documents/disposal` | required | `can_manage_disposals` | `screen` |
| `documents.bulk-dispose` | `POST` | `/documents/bulk-dispose` | required | `can_manage_disposals` | `blocked` |
| `documents.disposal.process` | `POST` | `/documents/disposal/process` | required | `can_manage_disposals` | `blocked` |
| `documents.dispose-filtered` | `POST` | `/documents/dispose-filtered` | required | `can_manage_disposals` | `blocked` |
| `documents.export` | `GET` | `/documents/export.csv` | required | `can_manage_documents` | `blocked` |
| `documents.snapshot.export` | `GET` | `/api/document-snapshot/export` | required | `can_manage_documents` | `blocked` |
| `documents.snapshot.export.create` | `POST` | `/document-snapshot-exports` | required | `can_manage_documents` | `blocked` |
| `documents.snapshot.export.rows` | `GET` | `/document-snapshot-exports/:manifestId/rows` | required | `can_manage_documents` | `blocked` |
| `documents.snapshot.export.finalize` | `POST` | `/document-snapshot-exports/:manifestId/finalize` | required | `can_manage_documents` | `blocked` |
| `documents.import.form` | `GET` | `/documents/import` | required | `can_manage_documents` | `screen` |
| `documents.new` | `GET` | `/documents/new` | required | `can_manage_documents` | `screen` |
| `documents.details` | `GET` | `/documents/:id` | required | authenticated | `screen` |
| `documents.edit.form` | `GET` | `/documents/:id/edit` | required | `can_manage_documents` | `screen` |
| `documents.edit` | `POST` | `/documents/:id/edit` | required | `can_manage_documents` | `blocked` |
| `documents.revise.form` | `GET` | `/documents/:id/revise` | required | `can_manage_documents` | `screen` |
| `documents.revise` | `POST` | `/documents/:id/revise` | required | `can_manage_documents` | `blocked` |
| `documents.move.form` | `GET` | `/documents/:id/move` | required | `can_move_documents` | `screen` |
| `documents.move` | `POST` | `/documents/:id/move` | required | `can_move_documents` | `blocked` |
| `documents.dispose` | `POST` | `/documents/:id/dispose` | required | `can_manage_disposals` | `blocked` |
| `documents.restore` | `POST` | `/documents/:id/restore` | required | policy:admin-only | `blocked` |
| `sets.list` | `GET` | `/sets` | required | authenticated | `screen` |
| `sets.create.form` | `GET` | `/sets/new` | required | `can_manage_sets` | `screen` |
| `sets.create` | `POST` | `/sets` | required | `can_manage_sets` | `blocked` |
| `sets.details` | `GET` | `/sets/:id` | required | authenticated | `screen` |
| `sets.export` | `GET` | `/sets/:id/export` | required | authenticated | `blocked` |
| `sets.export.csv` | `GET` | `/sets/:id/export.csv` | required | authenticated | `blocked` |
| `sets.edit.form` | `GET` | `/sets/:id/edit` | required | `can_manage_sets` | `screen` |
| `sets.clone.form` | `GET` | `/sets/:id/clone` | required | `can_manage_sets` | `screen` |
| `sets.clone` | `POST` | `/sets/:id/clone` | required | `can_manage_sets` | `blocked` |
| `sets.edit` | `POST` | `/sets/:id/edit` | required | `can_manage_sets` | `blocked` |
| `sets.delete` | `POST` | `/sets/:id/delete` | required | `can_manage_sets` | `blocked` |
| `sets.add` | `POST` | `/sets/:id/add` | required | `can_manage_sets` | `blocked` |
| `sets.remove` | `POST` | `/sets/:id/remove` | required | `can_manage_sets` | `blocked` |
| `sets.lock` | `POST` | `/sets/:id/lock` | required | `can_manage_sets` | `blocked` |
| `sets.unlock` | `POST` | `/sets/:id/unlock` | required | `can_manage_sets` | `blocked` |
| `racks.list` | `GET` | `/racks` | required | `can_manage_masters` | `screen` |
| `racks.create` | `POST` | `/racks` | required | `can_manage_masters` | `blocked` |
| `racks.new` | `GET` | `/racks/new` | required | `can_manage_masters` | `screen` |
| `racks.configure.form` | `GET` | `/racks/configure` | required | `can_manage_masters` | `screen` |
| `racks.configure` | `POST` | `/racks/configure` | required | `can_manage_masters` | `blocked` |
| `racks.details` | `GET` | `/racks/:id` | required | `can_manage_masters` | `screen` |
| `racks.edit.form` | `GET` | `/racks/:id/edit` | required | `can_manage_masters` | `screen` |
| `racks.edit` | `POST` | `/racks/:id/edit` | required | `can_manage_masters` | `blocked` |
| `categories.list` | `GET` | `/categories` | required | `can_manage_masters` | `screen` |
| `categories.save` | `POST` | `/categories` | required | `can_manage_masters` | `blocked` |
| `categories.edit` | `POST` | `/categories/:id/edit` | required | `can_manage_masters` | `blocked` |
| `categories.delete` | `POST` | `/categories/:id/delete` | required | `can_manage_masters` | `blocked` |
| `tags.list` | `GET` | `/tags` | required | `can_manage_masters` | `screen` |
| `tags.save` | `POST` | `/tags` | required | `can_manage_masters` | `blocked` |
| `tags.edit` | `POST` | `/tags/:id/edit` | required | `can_manage_masters` | `blocked` |
| `tags.delete` | `POST` | `/tags/:id/delete` | required | `can_manage_masters` | `blocked` |
| `disposal.list` | `GET` | `/disposal-batches` | required | `can_manage_disposals` | `screen` |
| `disposal.new` | `GET` | `/disposal-batches/new` | required | `can_manage_disposals` | `screen` |
| `disposal.create` | `POST` | `/disposal-batches` | required | `can_manage_disposals` | `blocked` |
| `disposal.details` | `GET` | `/disposal-batches/:id` | required | `can_manage_disposals` | `screen` |
| `disposal.edit.form` | `GET` | `/disposal-batches/:id/edit` | required | `can_manage_disposals` | `screen` |
| `disposal.edit` | `POST` | `/disposal-batches/:id/edit` | required | `can_manage_disposals` | `blocked` |
| `disposal.freeze` | `POST` | `/disposal-batches/:id/freeze` | required | `can_manage_disposals` | `blocked` |
| `disposal.start` | `POST` | `/disposal-batches/:id/start` | required | `can_manage_disposals` | `blocked` |
| `disposal.process` | `POST` | `/disposal-batches/:id/process` | required | `can_manage_disposals` | `blocked` |
| `disposal.cancel` | `POST` | `/disposal-batches/:id/cancel` | required | `can_manage_disposals` | `blocked` |
| `disposal.export` | `GET` | `/disposal-batches/:id/export.csv` | required | `can_manage_disposals` | `blocked` |
| `disposal.item.exclude` | `POST` | `/disposal-batches/:id/items/:itemId/exclude` | required | `can_manage_disposals` | `blocked` |
| `disposal.item.include` | `POST` | `/disposal-batches/:id/items/:itemId/include` | required | `can_manage_disposals` | `blocked` |
| `imports.list` | `GET` | `/document-import-jobs` | required | `can_manage_documents` | `screen` |
| `imports.create` | `POST` | `/document-import-jobs` | required | `can_manage_documents` | `blocked` |
| `imports.details` | `GET` | `/document-import-jobs/:id` | required | `can_manage_documents` | `screen` |
| `imports.failures` | `GET` | `/document-import-jobs/:id/failures.csv` | required | `can_manage_documents` | `blocked` |
| `imports.process` | `POST` | `/document-import-jobs/:id/process` | required | `can_manage_documents` | `blocked` |
| `imports.cancel` | `POST` | `/document-import-jobs/:id/cancel` | required | `can_manage_documents` | `blocked` |
| `snapshots.list` | `GET` | `/document-snapshots` | required | `can_manage_documents` | `screen` |
| `snapshots.create` | `POST` | `/document-snapshots` | required | `can_manage_documents` | `blocked` |
| `snapshots.details` | `GET` | `/document-snapshots/:id` | required | `can_manage_documents` | `screen` |
| `snapshots.rows` | `POST` | `/document-snapshots/:id/rows` | required | `can_manage_documents` | `blocked` |
| `snapshots.membership` | `POST` | `/document-snapshots/:id/membership` | required | `can_manage_documents` | `blocked` |
| `snapshots.prepare` | `POST` | `/document-snapshots/:id/prepare` | required | `can_manage_documents` | `blocked` |
| `snapshots.apply` | `POST` | `/document-snapshots/:id/apply` | required | `can_manage_documents+can_apply_document_snapshots` + policy:allOf:can_manage_documents+can_apply_document_snapshots | `blocked` |
| `snapshots.cancel` | `POST` | `/document-snapshots/:id/cancel` | required | `can_manage_documents` | `blocked` |

## Permission matrix

| permission/policy | route ids |
|---|---|
| `can_manage_disposals` | `documents.disposal`, `documents.bulk-dispose`, `documents.disposal.process`, `documents.dispose-filtered`, `documents.dispose`, `disposal.list`, `disposal.new`, `disposal.create`, `disposal.details`, `disposal.edit.form`, `disposal.edit`, `disposal.freeze`, `disposal.start`, `disposal.process`, `disposal.cancel`, `disposal.export`, `disposal.item.exclude`, `disposal.item.include` |
| `can_manage_documents` | `admin.data-quality`, `documents.duplicate`, `documents.create`, `documents.export`, `documents.snapshot.export`, `documents.snapshot.export.create`, `documents.snapshot.export.rows`, `documents.snapshot.export.finalize`, `documents.import.form`, `documents.new`, `documents.edit.form`, `documents.edit`, `documents.revise.form`, `documents.revise`, `imports.list`, `imports.create`, `imports.details`, `imports.failures`, `imports.process`, `imports.cancel`, `snapshots.list`, `snapshots.create`, `snapshots.details`, `snapshots.rows`, `snapshots.membership`, `snapshots.prepare`, `snapshots.cancel` |
| `can_manage_documents+can_apply_document_snapshots` + policy:allOf:can_manage_documents+can_apply_document_snapshots | `snapshots.apply` |
| `can_manage_masters` | `racks.list`, `racks.create`, `racks.new`, `racks.configure.form`, `racks.configure`, `racks.details`, `racks.edit.form`, `racks.edit`, `categories.list`, `categories.save`, `categories.edit`, `categories.delete`, `tags.list`, `tags.save`, `tags.edit`, `tags.delete` |
| `can_manage_sets` | `sets.create.form`, `sets.create`, `sets.edit.form`, `sets.clone.form`, `sets.clone`, `sets.edit`, `sets.delete`, `sets.add`, `sets.remove`, `sets.lock`, `sets.unlock` |
| `can_manage_users` | `admin.settings`, `admin.user.permissions.form`, `admin.user.permissions`, `admin.user.approve`, `admin.user.reject`, `admin.user.disable`, `admin.user.enable` |
| `can_manage_users` + policy:admin-only | `admin.user.create.form`, `admin.user.create`, `admin.role-templates`, `admin.role-template.edit.form`, `admin.role-template.edit`, `admin.role-template.apply`, `admin.user.password-reset.form`, `admin.user.password-reset`, `admin.user.delete.form`, `admin.user.delete` |
| `can_move_documents` | `documents.move.form`, `documents.move` |
| `can_view_audit` | `admin.search-report`, `admin.audit` |
| authenticated | `home.redirect`, `search.home`, `floor-plan.read`, `qa.read`, `search.suggestions`, `search.viewer`, `search.index`, `search.click`, `session.password.form`, `session.password.change`, `session.logout`, `session.logout.fallback`, `documents.list`, `documents.details`, `sets.list`, `sets.details`, `sets.export`, `sets.export.csv` |
| policy:admin-only | `documents.restore` |
| policy:always-404 | `session.signup.blocked` |
| policy:any-management-permission | `admin.dashboard` |
| policy:move-or-audit | `admin.movements` |
| public | `assets.generated`, `assets.images`, `assets.favicon`, `health.read`, `readiness.read`, `session.login.form`, `session.login` |

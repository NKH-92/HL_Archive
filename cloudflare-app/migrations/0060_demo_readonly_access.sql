-- 본사 시연 계정은 일반 업무 권한과 분리된 영구 조회 전용 access mode를 사용한다.
ALTER TABLE app_users
ADD COLUMN access_mode TEXT NOT NULL DEFAULT 'standard'
CHECK (access_mode IN ('standard', 'demo_readonly'));

CREATE TRIGGER trg_demo_readonly_user_insert_guard
BEFORE INSERT ON app_users
WHEN NEW.access_mode = 'demo_readonly'
  AND (
    NEW.role <> 'User'
    OR NEW.role_template_key IS NOT 'viewer'
    OR NEW.can_manage_documents <> 0
    OR NEW.can_move_documents <> 0
    OR NEW.can_manage_disposals <> 0
    OR NEW.can_manage_sets <> 0
    OR NEW.can_manage_masters <> 0
    OR NEW.can_manage_users <> 0
    OR NEW.can_view_audit <> 0
    OR NEW.can_apply_document_snapshots <> 0
  )
BEGIN
  SELECT RAISE(ABORT, 'DEMO_READONLY_POLICY_VIOLATION');
END;

CREATE TRIGGER trg_demo_readonly_user_update_guard
BEFORE UPDATE OF
  access_mode,
  role,
  role_template_key,
  can_manage_documents,
  can_move_documents,
  can_manage_disposals,
  can_manage_sets,
  can_manage_masters,
  can_manage_users,
  can_view_audit,
  can_apply_document_snapshots
ON app_users
WHEN (OLD.access_mode = 'demo_readonly' OR NEW.access_mode = 'demo_readonly')
  AND (
    NEW.access_mode <> 'demo_readonly'
    OR NEW.role <> 'User'
    OR NEW.role_template_key IS NOT 'viewer'
    OR NEW.can_manage_documents <> 0
    OR NEW.can_move_documents <> 0
    OR NEW.can_manage_disposals <> 0
    OR NEW.can_manage_sets <> 0
    OR NEW.can_manage_masters <> 0
    OR NEW.can_manage_users <> 0
    OR NEW.can_view_audit <> 0
    OR NEW.can_apply_document_snapshots <> 0
  )
BEGIN
  SELECT RAISE(ABORT, 'DEMO_READONLY_POLICY_VIOLATION');
END;

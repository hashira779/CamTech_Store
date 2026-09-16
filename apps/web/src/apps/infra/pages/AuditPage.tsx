import React from 'react';
import { AuditView } from '../views/AuditView';

/**
 * AuditPage — the AuditView component already owns its own useQuery
 * for audit log entries. This page wrapper keeps the pattern consistent
 * with all other infra pages, and provides a stable lazy-loading boundary.
 */
export default function AuditPage() {
  return <AuditView />;
}

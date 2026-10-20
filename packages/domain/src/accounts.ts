export function canChangeAccountStatus(permissions: readonly string[], userId: unknown, status: unknown, actorId: unknown): boolean {
  return permissions.includes('accounts.manage') && typeof userId==='string' && typeof actorId==='string' && userId!==actorId && (status==='active'||status==='suspended');
}
export function accountStatusPayload(profile: {id:unknown;version:unknown}, status: unknown, reason: string, requestId: string) {
  const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
  if(typeof profile.id!=='string'||!uuid.test(profile.id)||!uuid.test(requestId)||!Number.isSafeInteger(profile.version)||Number(profile.version)<1||!['active','suspended'].includes(String(status))) throw new Error('accounts.errors.invalid');
  if(reason.trim().length<3||reason.trim().length>1000) throw new Error('accounts.errors.reason');
  return {p_profile_id:profile.id,p_status:status as 'active'|'suspended',p_expected_version:Number(profile.version),p_reason:reason.trim(),p_request_id:requestId};
}

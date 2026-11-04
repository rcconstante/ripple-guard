/**
 * Identity and installation from the Forge invocation context.
 * Context values identify the caller; authorization is still decided by Jira
 * (asUser reads) and by ownership checks against stored records.
 */

export interface Caller {
  accountId: string;
  installationId: string;
  cloudId: string | null;
}

type UnknownRecord = Record<string, unknown>;

const asRecord = (v: unknown): UnknownRecord | null =>
  typeof v === 'object' && v !== null ? (v as UnknownRecord) : null;
const asString = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

/**
 * Installation id used to scope every record. For Jira this is the site ARI
 * (`ari:cloud:jira::site/<cloudId>`), present as `installContext` on resolver,
 * trigger and function contexts; derived from the cloud id when only that is given.
 */
export function installationIdFrom(context: unknown, fallbackCloudId?: string | null): string | null {
  const ctx = asRecord(context);
  const installContext = asString(ctx?.installContext);
  if (installContext) return installContext;
  const cloudId = asString(ctx?.cloudId) ?? fallbackCloudId ?? null;
  return cloudId ? `ari:cloud:jira::site/${cloudId}` : null;
}

/** Resolver (Custom UI) caller. */
export function callerFromResolverContext(context: unknown): Caller | null {
  const ctx = asRecord(context);
  const accountId = asString(ctx?.accountId);
  const installationId = installationIdFrom(context);
  if (!accountId || !installationId) return null;
  return { accountId, installationId, cloudId: asString(ctx?.cloudId) ?? cloudIdFromInstallContext(installationId) };
}

/** Rovo action caller: inputs and a nested `context` arrive in the payload; identity in the second argument. */
export function callerFromActionContext(payload: unknown, context: unknown): Caller | null {
  const ctx = asRecord(context);
  const payloadCtx = asRecord(asRecord(payload)?.context);
  const principal = asRecord(ctx?.principal);
  const accountId = asString(principal?.accountId) ?? asString(ctx?.accountId) ?? asString(payloadCtx?.accountId);
  const cloudId = asString(payloadCtx?.cloudId) ?? asString(ctx?.cloudId);
  const installationId = installationIdFrom(context, cloudId) ?? installationIdFrom(payloadCtx, cloudId);
  if (!accountId || !installationId) return null;
  return { accountId, installationId, cloudId: cloudId ?? cloudIdFromInstallContext(installationId) };
}

export function cloudIdFromInstallContext(installationId: string): string | null {
  return /^ari:cloud:jira::site\/([0-9a-f-]+)$/i.exec(installationId)?.[1] ?? null;
}

/** Issue id of the issue panel's issue, from the module context (never from the client payload). */
export function issueIdFromExtension(context: unknown): string | null {
  const extension = asRecord(asRecord(context)?.extension);
  const issue = asRecord(extension?.issue);
  const id = issue?.id;
  if (typeof id === 'number' && Number.isInteger(id) && id > 0) return String(id);
  return typeof id === 'string' && /^[1-9]\d{0,17}$/.test(id) ? id : null;
}

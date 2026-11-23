import { parseDuration } from "./common/parse-duration";
import { BrowserID } from "./browser_id";

export interface LockEntry {
  active?: boolean;
  /** Numeric PIN code (e.g. 1234) – shown with a numpad dialog. */
  pin?: string | number;
  /** Text or numeric code – numeric codes use the numpad dialog, text codes use a password-field dialog. */
  code?: string | number;
  /** Confirmation: `true` for default HA text, a plain string for custom text, or an object with optional `title` and `text`. */
  confirmation?: string | boolean | { title?: string; text?: string };
  /** Usernames this lock applies to. If omitted the lock applies to all non-admin users. */
  users?: string[];
  /** When `true` this lock also applies to (or, when no `users` list, exclusively targets) admins. */
  admins?: boolean;
  /** Usernames exempt from this lock when no `users` list is set. */
  except?: string[];
  /** Milliseconds (or a human-readable duration) to wait before another code attempt after a wrong entry. */
  retry_delay?: string | number;
  /** Maximum consecutive wrong attempts before the extended delay kicks in. */
  max_retries?: number;
  /** Milliseconds (or a human-readable duration) to wait after `max_retries` wrong attempts. */
  max_retries_delay?: string | number;
  /** Home Assistant action to run after each wrong code attempt. */
  retry_action?: Record<string, any>;
  /** Home Assistant action to run when `max_retries` is reached. */
  failed_action?: Record<string, any>;
}

/** Options forwarded to the HA `showEnterCodeDialog` helper. */
export interface CodeDialogConfig {
  title?: string;
  submit_text?: string;
  cancel_text?: string;
}

export interface LockUser {
  id?: string;
  name?: string;
  is_admin?: boolean;
}

export interface LockAccessConfig {
  locks?: LockEntry[];
  permissive?: boolean;
  code_dialog?: CodeDialogConfig;
}

export interface LockAccessState {
  lock: LockEntry | null;
  requiresUnlock: boolean;
  blocked: boolean;
}

export interface LockRetryState {
  retryCount: number;
  retryUntil: number;
}

interface LockActionDataContext {
  user: LockUser;
  retryCount: number;
  browserId: string | null;
}

export const createLockRetryState = (): LockRetryState => ({
  retryCount: 0,
  retryUntil: 0,
});

/**
 * Resolve explicit UIX values in an action's `data`, without treating data as
 * a template. Exact-token matching preserves the type of retry values.
 */
export const withLockActionData = (
  action: Record<string, any>,
  context: LockActionDataContext,
): Record<string, any> => {
  const values: Record<string, unknown> = {
    "$uix.user": context.user.name ?? null,
    "$uix.user.id": context.user.id ?? null,
    "$uix.user.name": context.user.name ?? null,
    "$uix.user.is_admin": context.user.is_admin === true,
    "$uix.retry": context.retryCount,
    "$uix.retry.count": context.retryCount,
    "$uix.browser": context.browserId,
    "$uix.browser_id": context.browserId,
  };
  const substitute = (value: unknown): unknown => {
    if (typeof value === "string" && Object.prototype.hasOwnProperty.call(values, value)) return values[value];
    if (Array.isArray(value)) return value.map(substitute);
    if (value && typeof value === "object") {
      const substituted: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value)) substituted[key] = substitute(item);
      return substituted;
    }
    return value;
  };

  if (!("data" in action)) return { ...action };
  return { ...action, data: substitute(action.data) };
};

export const createLockActionDataContext = (
  user?: LockUser,
  retryCount = 0,
): LockActionDataContext => ({
  user: user ?? {},
  retryCount,
  browserId: BrowserID() || null,
});

/** Dispatch a configured lock action without letting it interrupt the lock flow. */
const dispatchLockAction = (anchor: HTMLElement, action: unknown, context: LockActionDataContext): void => {
  if (!action || typeof action !== "object" || Array.isArray(action) || typeof (action as Record<string, unknown>).action !== "string") return;
  anchor.dispatchEvent(new CustomEvent("hass-action", {
    bubbles: true,
    composed: true,
    detail: { config: { tap_action: withLockActionData(action as Record<string, any>, context) }, action: "tap" },
  }));
};

/**
 * Select the first active lock applicable to a user, falling back to the first
 * matching inactive entry when there is no active match.
 */
export const findMatchingLock = (locks: LockEntry[], user?: LockUser): LockEntry | null => {
  const userName = user?.name ?? "";
  const isAdmin = user?.is_admin === true;
  let firstInactiveMatch: LockEntry | null = null;

  for (const lock of locks) {
    const hasUsersList = Array.isArray(lock.users) && lock.users.length > 0;
    let matches = false;

    if (hasUsersList) {
      matches = lock.users!.includes(userName) || (isAdmin && lock.admins === true);
    } else {
      if (isAdmin && lock.admins !== true) continue;
      if (Array.isArray(lock.except) && lock.except.includes(userName)) continue;
      matches = true;
    }

    if (matches) {
      if (lock.active !== false) return lock;
      if (firstInactiveMatch === null) firstInactiveMatch = lock;
    }
  }

  return firstInactiveMatch;
};

/** Resolve whether the user needs to unlock, is already allowed, or is blocked. */
export const getLockAccessState = (config: LockAccessConfig, user?: LockUser): LockAccessState => {
  const lock = findMatchingLock(Array.isArray(config.locks) ? config.locks : [], user);
  if (lock !== null) {
    return { lock, requiresUnlock: lock.active !== false, blocked: false };
  }
  if (config.permissive === true || user?.is_admin === true) {
    return { lock: null, requiresUnlock: false, blocked: false };
  }
  return { lock: null, requiresUnlock: false, blocked: true };
};

/**
 * Run the matching code and confirmation challenges. Returns true only when
 * the user may proceed. Retry state belongs to the caller so it can survive
 * repeated attempts for the same lock.
 */
export const requestLockAccess = async ({
  config,
  user,
  anchor,
  retryState,
}: {
  config: LockAccessConfig;
  user?: LockUser;
  anchor: HTMLElement;
  retryState: LockRetryState;
}): Promise<boolean> => {
  const state = getLockAccessState(config, user);
  if (!state.requiresUnlock) return !state.blocked;
  if (Date.now() < retryState.retryUntil) return false;

  let helpers: any;
  try {
    helpers = await (window as any).loadCardHelpers();
  } catch {
    return false;
  }

  const lock = state.lock!;
  const codeValue = lock.code ?? lock.pin;
  if (codeValue !== undefined && codeValue !== null && String(codeValue) !== "") {
    const dialog = config.code_dialog ?? {};
    const entered = await helpers.showEnterCodeDialog(anchor, {
      codeFormat: /^\d+$/.test(String(codeValue)) ? "number" : "text",
      ...(dialog.title !== undefined && { title: dialog.title }),
      ...(dialog.submit_text !== undefined && { submitText: dialog.submit_text }),
      ...(dialog.cancel_text !== undefined && { cancelText: dialog.cancel_text }),
    }) as string | null;

    if (entered === null) return false;
    if (String(entered) !== String(codeValue)) {
      retryState.retryCount++;
      const retryCount = retryState.retryCount;
      const maxRetriesReached = lock.max_retries !== undefined && retryCount >= lock.max_retries;
      if (maxRetriesReached) {
        retryState.retryUntil = Date.now() + (parseDuration(lock.max_retries_delay) ?? 30000);
        retryState.retryCount = 0;
      } else if (lock.retry_delay) {
        retryState.retryUntil = Date.now() + (parseDuration(lock.retry_delay) ?? 0);
      }
      const actionContext = createLockActionDataContext(user, retryCount);
      dispatchLockAction(anchor, lock.retry_action, actionContext);
      if (maxRetriesReached) dispatchLockAction(anchor, lock.failed_action, actionContext);
      await helpers.showAlertDialog(anchor, { title: "Wrong code" });
      return false;
    }
    retryState.retryCount = 0;
  }

  if (lock.confirmation !== undefined && lock.confirmation !== false) {
    const confirmation = lock.confirmation;
    const confirmed = await helpers.showConfirmationDialog(anchor, {
      title: typeof confirmation === "object" ? confirmation.title : undefined,
      text: typeof confirmation === "string"
        ? confirmation
        : typeof confirmation === "object"
          ? confirmation.text
          : undefined,
    }) as boolean;
    if (!confirmed) return false;
  }

  return true;
};

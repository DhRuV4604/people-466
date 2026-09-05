/**
 * The shape a mutation returns, kept apart from the code that produces it.
 *
 * `mutate.ts` is `server-only` and reaches `next/headers`, so a client
 * component that wanted the idle value from it would drag the whole server
 * client into the browser bundle. The type alone is erased at compile time;
 * `FORM_IDLE` is not, and that is the difference this split exists for.
 */
/**
 * The one shape every mutation returns, so `useActionState` looks the same on
 * every screen: a banner message, per-field messages, and a success flag the
 * dialog uses to close itself.
 */
export type FormState<T = unknown> = {
  ok?: boolean;
  /** Banner message, for anything not attributable to a single field. */
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Confirmation to show once it succeeded. */
  message?: string;
  /** Id of the record that was written, so the caller can navigate to it. */
  id?: string;
  /**
   * What the API returned. For a caller that needs more than "it worked" —
   * whether an invite actually went out, say.
   */
  record?: T;
  /**
   * The write succeeded but something about it needs saying, and a toast will
   * not do: it holds a value that exists nowhere else and has to be read,
   * copied, and acted on before it is gone.
   */
  warning?: {
    title: string;
    body: string;
    /** Shown in a copyable box. Never logged, never stored. */
    secret?: string;
    secretLabel?: string;
  };
};

export const FORM_IDLE: FormState = {};

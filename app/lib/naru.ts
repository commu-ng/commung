// The page's Naru client: the site's queries and mutations, as the signed-in
// member when there is one and as a visitor otherwise, live queries, and
// sign-in. Every call to the site's code goes through here.
import {
  createNaru,
  type Json,
  type Live,
  type Member,
  NaruError,
} from "https://sdk.naru.pub/sdk/1.1.0/naru.js";

export { NaruError };

export const naru = createNaru();

let memberSession: Promise<Member | null> | null = null;

/** The signed-in member, or null; finishes a sign-in Naru redirected back from. */
export function getMember(): Promise<Member | null> {
  memberSession ??= naru.members.session().catch(() => null);
  return memberSession;
}

/** Sends the visitor to Naru to sign in as a member, and back here. */
export function signIn(): Promise<void> {
  return naru.members.signIn();
}

export async function signOut(): Promise<void> {
  const member = await getMember();
  memberSession = Promise.resolve(null);
  await member?.signOut();
}

/** Runs `name` from the site's _naru/queries/, as the member if signed in. */
export async function query<R>(name: string, args?: object): Promise<R> {
  const member = await getMember();
  return (member ?? naru).query<R>(name, args as Json);
}

/** Runs `name` from the site's _naru/mutations/ as the signed-in member. */
export async function mutate<R>(name: string, args?: object): Promise<R> {
  const member = await getMember();
  if (!member) {
    await signIn();
    throw new Error("로그인이 필요합니다");
  }
  return member.mutate<R>(name, args as Json);
}

/**
 * Keeps a query's answer current: `onResult` with each new answer, until the
 * returned function is called.
 */
export function subscribe<R>(
  name: string,
  args: object | null,
  onResult: (result: R) => void,
  onError?: (error: NaruError) => void,
): () => void {
  let live: Live | null = null;
  let closed = false;
  getMember().then((member) => {
    if (closed) return;
    live = (member ?? naru).subscribe<R>(name, (args ?? null) as Json, onResult, {
      onError: (error) => onError?.(error),
    });
  });
  return () => {
    closed = true;
    live?.close();
  };
}

/** The message of a failed call, for a toast; `fallback` for anything else. */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof NaruError) return error.message || fallback;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** The site's own reason a call refused with (`ctx.fail`'s details.reason). */
export function reasonOf(error: unknown): string | null {
  if (!(error instanceof NaruError)) return null;
  const details = error.details as { reason?: unknown } | undefined;
  return typeof details?.reason === "string" ? details.reason : null;
}

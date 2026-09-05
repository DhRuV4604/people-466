import { randomInt } from 'node:crypto';

/**
 * The password a new account is invited with.
 *
 * It is read off an email and typed once, so it avoids the characters people
 * misread — no O/0, no l/1/I — and groups into blocks rather than running as
 * one string. It is not meant to be remembered: the account is flagged
 * `mustChangePassword`, so the next sign-in has to replace it.
 *
 * `randomInt` rather than `Math.random`: this is a credential, and a
 * predictable one is no credential at all.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const BLOCKS = 3;
const BLOCK_LENGTH = 4;

export function generateOneTimePassword(): string {
  const blocks: string[] = [];

  for (let block = 0; block < BLOCKS; block += 1) {
    let value = '';
    for (let i = 0; i < BLOCK_LENGTH; i += 1) {
      value += ALPHABET[randomInt(ALPHABET.length)];
    }
    blocks.push(value);
  }

  return blocks.join('-');
}

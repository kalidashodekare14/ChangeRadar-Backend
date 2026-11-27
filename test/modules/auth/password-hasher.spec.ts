import { PasswordHasher } from '../../../src/modules/auth/services/password-hasher.service';

const DEV_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$PFTD+wAYrFvlGEj20XN3PQ$iipJIuwNYuSDWrP/Qm9LTIqZ8SvduUv+yKR3FQ+izqQ';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('verifies the Phase 2 development seed hash', async () => {
    await expect(hasher.verify(DEV_HASH, 'ChangerRadar-dev-only')).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    await expect(hasher.verify(DEV_HASH, 'wrong-password')).resolves.toBe(false);
  });

  it('produces a different argon2id hash for the same password', async () => {
    const first = await hasher.hash('a-strong-password');
    const second = await hasher.hash('a-strong-password');
    expect(first).toContain('$argon2id$');
    expect(first).not.toBe(second);
    await expect(hasher.verify(first, 'a-strong-password')).resolves.toBe(true);
  });

  it('never throws for a malformed stored hash', async () => {
    await expect(hasher.verify('not-a-phc-string', 'anything')).resolves.toBe(false);
  });
});

import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';

/** argon2id with the parameters used by the Phase 2 dev seed (§9.1). */
@Injectable()
export class PasswordHasher {
  async hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      // Malformed or unavailable hashes never authenticate and are never logged.
      return false;
    }
  }
}

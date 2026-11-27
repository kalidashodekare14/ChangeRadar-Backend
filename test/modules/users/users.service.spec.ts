import { AppException } from '../../../src/common/errors/app.exception';
import { PrismaService } from '../../../src/infrastructure/database/prisma.service';
import { SessionsRepository } from '../../../src/modules/auth/repositories/sessions.repository';
import { UsersRepository } from '../../../src/modules/auth/repositories/users.repository';
import { PasswordHasher } from '../../../src/modules/auth/services/password-hasher.service';
import { UsersService } from '../../../src/modules/users/users.service';

const USER = {
  id: 'user-1',
  name: 'Ada',
  email: 'ada@example.com',
  passwordHash: 'old-hash',
  isActive: true,
};

function setup() {
  const tx = {} as object;
  const prisma = {
    $transaction: jest.fn(async (fn: (client: object) => Promise<unknown>) => fn(tx)),
  } as unknown as PrismaService;
  const users = {
    findById: jest.fn().mockResolvedValue(USER),
    updateName: jest.fn().mockResolvedValue(USER),
    updatePasswordHash: jest.fn().mockResolvedValue(undefined),
  } as unknown as UsersRepository;
  const sessions = {
    revokeOthers: jest.fn().mockResolvedValue(2),
  } as unknown as SessionsRepository;
  const hasher = {
    verify: jest.fn().mockResolvedValue(true),
    hash: jest.fn().mockResolvedValue('new-hash'),
  } as unknown as PasswordHasher;
  return {
    service: new UsersService(prisma, users, sessions, hasher),
    prisma,
    users,
    sessions,
    hasher,
    tx,
  };
}

describe('UsersService', () => {
  it('updates the profile name', async () => {
    const mocks = setup();
    await expect(mocks.service.updateName(USER.id, 'Grace')).resolves.toMatchObject({
      id: USER.id,
      email: USER.email,
    });
    expect(mocks.users.updateName).toHaveBeenCalledWith(expect.anything(), USER.id, 'Grace');
  });

  it('rehashes the password and revokes other sessions, keeping the current one', async () => {
    const mocks = setup();
    await expect(
      mocks.service.changePassword(USER.id, 'session-1', 'old-password', 'new-password'),
    ).resolves.toEqual({ changed: true });
    expect(mocks.hasher.verify).toHaveBeenCalledWith('old-hash', 'old-password');
    expect(mocks.users.updatePasswordHash).toHaveBeenCalledWith(mocks.tx, USER.id, 'new-hash');
    expect(mocks.sessions.revokeOthers).toHaveBeenCalledWith(
      mocks.tx,
      USER.id,
      'session-1',
      expect.any(Date),
    );
  });

  it('rejects a wrong current password without changing anything', async () => {
    const mocks = setup();
    jest.spyOn(mocks.hasher, 'verify').mockResolvedValue(false);
    await expect(
      mocks.service.changePassword(USER.id, 'session-1', 'wrong', 'new-password'),
    ).rejects.toMatchObject({ errorCode: 'INVALID_CREDENTIALS' });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.users.updatePasswordHash).not.toHaveBeenCalled();
  });

  it('rejects password change for a user without a stored hash', async () => {
    const mocks = setup();
    jest.spyOn(mocks.users, 'findById').mockResolvedValue({ ...USER, passwordHash: null });
    await expect(
      mocks.service.changePassword(USER.id, 'session-1', 'anything', 'new-password'),
    ).rejects.toBeInstanceOf(AppException);
  });
});

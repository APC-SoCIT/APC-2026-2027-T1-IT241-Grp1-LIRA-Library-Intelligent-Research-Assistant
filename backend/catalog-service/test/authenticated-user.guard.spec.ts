import { ConfigService } from '@nestjs/config';
import { AuthenticatedUserGuard, AuthenticatedUserRequest } from '../src/shared/authenticated-user.guard';

describe('AuthenticatedUserGuard', () => {
  const config = {
    get: jest.fn((key: string) => ({
      'app.semantic.supabaseUrl': 'https://project.supabase.co',
      'app.semantic.supabaseServiceRoleKey': 'service-role-key',
    }[key])),
  } as unknown as ConfigService;
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('accepts any valid signed-in Supabase account without checking its profile role', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'signed-in-user-id' }),
    }) as jest.Mock;
    const request = { headers: { authorization: 'Bearer access-token' } } as AuthenticatedUserRequest;
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as never;

    await expect(new AuthenticatedUserGuard(config).canActivate(context)).resolves.toBe(true);

    expect(request.authenticatedUser).toEqual({ id: 'signed-in-user-id' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://project.supabase.co/auth/v1/user',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer access-token' }) }),
    );
  });
});

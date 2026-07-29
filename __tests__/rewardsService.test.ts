import { getOrCreateRewards, addRewardPoints, getLevelFromTotal } from '@/services/rewardsService';

jest.mock('@/template', () => ({
  getSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => ({
            data: { id: 'r1', user_id: 'u1', points: 100, total_earned: 100, total_redeemed: 0, level: 'bronze' },
            error: null,
          }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: () => ({ data: { id: 'r1' }, error: null }),
        }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => ({ data: { id: 'r1', points: 150, level: 'bronze' }, error: null }),
          }),
        }),
      }),
      order: () => ({ limit: () => ({ data: [], error: null }) }),
    }),
  }),
}));

describe('rewardsService', () => {
  it('getLevelFromTotal returns correct level', () => {
    expect(getLevelFromTotal(0)).toBe('bronze');
    expect(getLevelFromTotal(499)).toBe('bronze');
    expect(getLevelFromTotal(500)).toBe('silver');
    expect(getLevelFromTotal(1500)).toBe('gold');
    expect(getLevelFromTotal(3000)).toBe('platinum');
  });

  it('getOrCreateRewards returns existing record', async () => {
    const { data, error } = await getOrCreateRewards('u1');
    expect(error).toBeNull();
    expect(data).toBeTruthy();
  });

  it('addRewardPoints increases points', async () => {
    const { data, error } = await addRewardPoints('u1', 50, 'test earn');
    expect(error).toBeNull();
    expect(data).toBeTruthy();
  });
});

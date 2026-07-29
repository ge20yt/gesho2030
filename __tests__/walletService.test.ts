import { WalletService, WalletTransactionType } from '@/lib/wallet/walletService';

function createMockSupabase(walletData: any = null, txData: any = null) {
  const wallet = {
    id: 'w1', user_id: 'u1', balance: 100, locked_balance: 0, currency: 'EGP',
    ...walletData,
  };
  const insertChain = {
    select: () => ({ single: () => ({ data: txData ?? { id: 't1' }, error: null }) }),
  };
  return {
    from: jest.fn((table: string) => {
      if (table === 'wallets') {
        return {
          select: () => ({
            eq: () => ({ single: () => ({ data: wallet, error: null }) }),
          }),
          update: () => ({ eq: () => ({ error: null }) }),
        };
      }
      if (table === 'wallet_transactions') {
        return {
          insert: () => insertChain,
          select: () => ({
            eq: () => ({
              order: () => ({ range: () => ({ data: [], error: null }) }),
            }),
          }),
        };
      }
      return {};
    }),
  };
}

describe('WalletService', () => {
  it('getWallet returns cached wallet on second call', async () => {
    const mock = createMockSupabase();
    const svc = new WalletService(mock);
    const w1 = await svc.getWallet('u1');
    const w2 = await svc.getWallet('u1');
    expect(w1).toBeTruthy();
    expect(w2).toBeTruthy();
    expect(mock.from).toHaveBeenCalledTimes(1);
  });

  it('addTransaction credits balance for CREDIT type', async () => {
    const mock = createMockSupabase({ balance: 100 });
    const svc = new WalletService(mock);
    const tx = await svc.addTransaction('u1', {
      type: WalletTransactionType.CREDIT,
      amount: 50,
      description: 'test credit',
    });
    expect(tx).toBeTruthy();
  });

  it('addTransaction throws on insufficient balance for DEBIT', async () => {
    const mock = createMockSupabase({ balance: 10 });
    const svc = new WalletService(mock);
    await expect(
      svc.addTransaction('u1', {
        type: WalletTransactionType.DEBIT,
        amount: 50,
        description: 'test debit',
      })
    ).rejects.toThrow('Insufficient balance');
  });

  it('getBalance returns available, locked, and total', async () => {
    const mock = createMockSupabase({ balance: 200, locked_balance: 50 });
    const svc = new WalletService(mock);
    const bal = await svc.getBalance('u1');
    expect(bal).toBeTruthy();
    expect(bal!.available).toBe(200);
    expect(bal!.currency).toBe('EGP');
  });

  it('onTransaction registers and notifies listeners', async () => {
    const mock = createMockSupabase({ balance: 100 });
    const svc = new WalletService(mock);
    const cb = jest.fn();
    svc.onTransaction('u1', cb);
    await svc.addTransaction('u1', {
      type: WalletTransactionType.CREDIT,
      amount: 50,
      description: 'test',
    });
    expect(cb).toHaveBeenCalled();
  });
});

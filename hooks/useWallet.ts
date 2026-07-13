import { useCallback, useEffect, useState } from 'react';
import { WalletService } from '../lib/wallet/walletService';
import type { Wallet, WalletTransaction } from '../lib/database/schema';

interface WalletState {
  wallet: Wallet | null;
  transactions: WalletTransaction[];
  isLoading: boolean;
  error: string | null;
}

export const useWallet = (userId: string | null) => {
  const [state, setState] = useState<WalletState>({
    wallet: null,
    transactions: [],
    isLoading: true,
    error: null,
  });

  const walletService = new WalletService();

  const fetchWallet = useCallback(async () => {
    if (!userId) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const wallet = await walletService.getWallet(userId);
      setState(prev => ({ ...prev, wallet, isLoading: false }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch wallet';
      setState(prev => ({ ...prev, error: message, isLoading: false }));
    }
  }, [userId]);

  const fetchTransactions = useCallback(async (limit = 20, offset = 0) => {
    if (!userId) return;

    try {
      const transactions = await walletService.getTransactions(userId, limit, offset);
      setState(prev => ({ ...prev, transactions }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch transactions';
      setState(prev => ({ ...prev, error: message }));
    }
  }, [userId]);

  const addFunds = useCallback(async (amount: number, method: string, reference: string) => {
    if (!userId) throw new Error('User not authenticated');

    try {
      const transaction = await walletService.addFunds(userId, amount, method, reference);
      await fetchWallet();
      await fetchTransactions();
      return transaction;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add funds';
      setState(prev => ({ ...prev, error: message }));
      throw error;
    }
  }, [userId, fetchWallet, fetchTransactions]);

  const withdraw = useCallback(async (amount: number, method: string, reference: string) => {
    if (!userId) throw new Error('User not authenticated');

    try {
      const transaction = await walletService.withdraw(userId, amount, method, reference);
      await fetchWallet();
      await fetchTransactions();
      return transaction;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to withdraw';
      setState(prev => ({ ...prev, error: message }));
      throw error;
    }
  }, [userId, fetchWallet, fetchTransactions]);

  const getBalance = useCallback((): number => {
    return state.wallet?.balance || 0;
  }, [state.wallet]);

  const getStats = useCallback(() => {
    if (!state.wallet) {
      return {
        balance: 0,
        totalEarned: 0,
        totalSpent: 0,
        lastTransaction: null,
      };
    }

    return {
      balance: state.wallet.balance,
      totalEarned: state.wallet.totalEarned || 0,
      totalSpent: state.wallet.totalSpent || 0,
      lastTransaction: state.transactions[0] || null,
    };
  }, [state.wallet, state.transactions]);

  // Fetch wallet on mount or userId change
  useEffect(() => {
    fetchWallet();
    if (userId) {
      fetchTransactions();
    }
  }, [userId, fetchWallet, fetchTransactions]);

  // Refresh wallet periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (userId) {
        fetchWallet();
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [userId, fetchWallet]);

  return {
    ...state,
    fetchWallet,
    fetchTransactions,
    addFunds,
    withdraw,
    getBalance,
    getStats,
  };
};

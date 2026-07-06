/**
 * Wallet Service
 * Comprehensive wallet management system for drivers and customers
 */

import type { Wallet, WalletTransaction } from '@/lib/database/schema';

export enum WalletTransactionType {
  CREDIT = 'credit',
  DEBIT = 'debit',
  LOCK = 'lock',
  UNLOCK = 'unlock',
  COMMISSION = 'commission',
  REFUND = 'refund',
  PENALTY = 'penalty',
  BONUS = 'bonus',
}

export interface TransactionRequest {
  type: WalletTransactionType;
  amount: number;
  description: string;
  reference?: string;
  metadata?: Record<string, any>;
}

export interface WithdrawalRequest {
  amount: number;
  method: 'bank_transfer' | 'mobile_wallet' | 'check';
  accountDetails: Record<string, any>;
  reason?: string;
}

export interface WalletBalance {
  available: number;
  locked: number;
  total: number;
  currency: string;
  lastUpdated: Date;
}

export class WalletService {
  private supabase: any; // TODO: Properly type Supabase client
  private walletCache: Map<string, Wallet> = new Map();
  private transactionListeners: Map<string, Set<(tx: WalletTransaction) => void>> = new Map();

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
  }

  /**
   * Get user wallet
   */
  async getWallet(userId: string): Promise<Wallet | null> {
    try {
      // Check cache first
      if (this.walletCache.has(userId)) {
        return this.walletCache.get(userId)!;
      }

      // Fetch from database
      const { data, error } = await this.supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Failed to fetch wallet:', error);
        return null;
      }

      // Cache and return
      this.walletCache.set(userId, data);
      return data;
    } catch (error) {
      console.error('Wallet fetch error:', error);
      return null;
    }
  }

  /**
   * Get wallet balance
   */
  async getBalance(userId: string): Promise<WalletBalance | null> {
    const wallet = await this.getWallet(userId);
    if (!wallet) return null;

    return {
      available: wallet.balance,
      locked: wallet.lockedBalance,
      total: wallet.balance + wallet.lockedBalance,
      currency: wallet.currency,
      lastUpdated: new Date(),
    };
  }

  /**
   * Record transaction
   */
  async addTransaction(userId: string, request: TransactionRequest): Promise<WalletTransaction> {
    try {
      const wallet = await this.getWallet(userId);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Calculate new balance
      let newBalance = wallet.balance;
      if (request.type === WalletTransactionType.CREDIT || request.type === WalletTransactionType.COMMISSION) {
        newBalance += request.amount;
      } else if (request.type === WalletTransactionType.DEBIT || request.type === WalletTransactionType.PENALTY) {
        if (newBalance < request.amount) {
          throw new Error('Insufficient balance');
        }
        newBalance -= request.amount;
      }

      // Create transaction record
      const { data, error } = await this.supabase
        .from('wallet_transactions')
        .insert({
          wallet_id: wallet.id,
          type: request.type,
          amount: request.amount,
          balance: newBalance,
          description: request.description,
          reference: request.reference,
          metadata: request.metadata,
          created_at: new Date(),
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Update wallet balance
      await this.updateWalletBalance(wallet.id, newBalance);

      // Clear cache
      this.walletCache.delete(userId);

      // Notify listeners
      this.notifyTransactionListeners(userId, data);

      return data;
    } catch (error) {
      console.error('Transaction error:', error);
      throw error;
    }
  }

  /**
   * Request withdrawal
   */
  async requestWithdrawal(userId: string, request: WithdrawalRequest): Promise<any> {
    try {
      const balance = await this.getBalance(userId);
      if (!balance || balance.available < request.amount) {
        throw new Error('Insufficient balance for withdrawal');
      }

      // Create withdrawal record
      const { data, error } = await this.supabase
        .from('wallet_withdrawals')
        .insert({
          user_id: userId,
          amount: request.amount,
          method: request.method,
          account_details: request.accountDetails,
          reason: request.reason,
          status: 'pending',
          created_at: new Date(),
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Lock amount in wallet
      await this.lockAmount(userId, request.amount);

      return data;
    } catch (error) {
      console.error('Withdrawal request error:', error);
      throw error;
    }
  }

  /**
   * Lock amount (for pending transactions)
   */
  async lockAmount(userId: string, amount: number): Promise<void> {
    try {
      const wallet = await this.getWallet(userId);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const { error } = await this.supabase
        .from('wallets')
        .update({
          locked_balance: wallet.lockedBalance + amount,
        })
        .eq('id', wallet.id);

      if (error) {
        throw error;
      }

      this.walletCache.delete(userId);
    } catch (error) {
      console.error('Lock amount error:', error);
      throw error;
    }
  }

  /**
   * Unlock amount
   */
  async unlockAmount(userId: string, amount: number): Promise<void> {
    try {
      const wallet = await this.getWallet(userId);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const newLockedBalance = Math.max(0, wallet.lockedBalance - amount);

      const { error } = await this.supabase
        .from('wallets')
        .update({
          locked_balance: newLockedBalance,
        })
        .eq('id', wallet.id);

      if (error) {
        throw error;
      }

      this.walletCache.delete(userId);
    } catch (error) {
      console.error('Unlock amount error:', error);
      throw error;
    }
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<WalletTransaction[]> {
    try {
      const wallet = await this.getWallet(userId);
      if (!wallet) {
        return [];
      }

      const { data, error } = await this.supabase
        .from('wallet_transactions')
        .select('*')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Failed to fetch transactions:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Transaction history error:', error);
      return [];
    }
  }

  /**
   * Get monthly report
   */
  async getMonthlyReport(userId: string, year: number, month: number): Promise<any> {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const { data, error } = await this.supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Calculate statistics
      const transactions = data || [];
      const credits = transactions
        .filter((t: any) => t.type === WalletTransactionType.CREDIT || t.type === WalletTransactionType.COMMISSION)
        .reduce((sum: number, t: any) => sum + t.amount, 0);

      const debits = transactions
        .filter((t: any) => t.type === WalletTransactionType.DEBIT || t.type === WalletTransactionType.PENALTY)
        .reduce((sum: number, t: any) => sum + t.amount, 0);

      return {
        period: { year, month },
        totalTransactions: transactions.length,
        totalCredits: credits,
        totalDebits: debits,
        netBalance: credits - debits,
        transactions,
      };
    } catch (error) {
      console.error('Monthly report error:', error);
      throw error;
    }
  }

  /**
   * Add transaction listener
   */
  onTransaction(userId: string, callback: (transaction: WalletTransaction) => void): () => void {
    if (!this.transactionListeners.has(userId)) {
      this.transactionListeners.set(userId, new Set());
    }

    this.transactionListeners.get(userId)!.add(callback);

    return () => {
      this.transactionListeners.get(userId)?.delete(callback);
    };
  }

  private notifyTransactionListeners(userId: string, transaction: WalletTransaction): void {
    const listeners = this.transactionListeners.get(userId);
    if (listeners) {
      listeners.forEach((callback) => {
        callback(transaction);
      });
    }
  }

  private async updateWalletBalance(walletId: string, newBalance: number): Promise<void> {
    const { error } = await this.supabase
      .from('wallets')
      .update({
        balance: newBalance,
      })
      .eq('id', walletId);

    if (error) {
      throw error;
    }
  }
}

export const createWalletService = (supabaseClient: any) => {
  return new WalletService(supabaseClient);
};

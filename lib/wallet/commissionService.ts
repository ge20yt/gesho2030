/**
 * Commission Service
 * Calculate, track, and manage driver commissions
 */

import type { Commission } from '@/lib/database/schema';

export interface CommissionRule {
  id: string;
  name: string;
  type: 'percentage' | 'fixed' | 'tiered';
  baseValue: number;
  conditions?: {
    minAmount?: number;
    maxAmount?: number;
    driverLevel?: string[];
    dayOfWeek?: number[];
    timeOfDay?: { start: string; end: string };
  };
  enabled: boolean;
  priority: number;
}

export interface CommissionCalculation {
  tripAmount: number;
  baseCommission: number;
  bonusCommission?: number;
  totalCommission: number;
  applicableRules: CommissionRule[];
}

export class CommissionService {
  private supabase: any;
  private commissionRules: CommissionRule[] = [];
  private rulesCacheTime: number = 0;
  private readonly CACHE_DURATION = 3600000; // 1 hour

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
  }

  /**
   * Initialize commission rules from database
   */
  async initialize(): Promise<void> {
    await this.loadCommissionRules();
  }

  /**
   * Load commission rules from database
   */
  private async loadCommissionRules(): Promise<void> {
    try {
      const now = Date.now();
      if (this.rulesCacheTime && now - this.rulesCacheTime < this.CACHE_DURATION) {
        return; // Use cached rules
      }

      const { data, error } = await this.supabase
        .from('commission_rules')
        .select('*')
        .eq('enabled', true)
        .order('priority', { ascending: true });

      if (error) {
        console.error('Failed to load commission rules:', error);
        this.commissionRules = this.getDefaultRules();
      } else {
        this.commissionRules = data || this.getDefaultRules();
        this.rulesCacheTime = now;
      }
    } catch (error) {
      console.error('Commission rules load error:', error);
      this.commissionRules = this.getDefaultRules();
    }
  }

  /**
   * Calculate commission for a trip
   */
  async calculateCommission(
    tripAmount: number,
    driverId: string,
    tripData?: any
  ): Promise<CommissionCalculation> {
    await this.loadCommissionRules();

    let baseCommission = 0;
    let bonusCommission = 0;
    const applicableRules: CommissionRule[] = [];

    // Get driver level for eligibility checks
    const driverLevel = await this.getDriverLevel(driverId);

    for (const rule of this.commissionRules) {
      if (!this.isRuleApplicable(rule, tripAmount, driverLevel, tripData)) {
        continue;
      }

      applicableRules.push(rule);

      if (rule.type === 'percentage') {
        baseCommission = (tripAmount * rule.baseValue) / 100;
      } else if (rule.type === 'fixed') {
        baseCommission = rule.baseValue;
      } else if (rule.type === 'tiered') {
        baseCommission = this.calculateTieredCommission(tripAmount, rule.baseValue);
      }

      // Only apply first matching rule for base commission
      if (baseCommission > 0) {
        break;
      }
    }

    // Check for bonus commissions
    bonusCommission = await this.calculateBonusCommission(driverId, tripAmount);

    return {
      tripAmount,
      baseCommission,
      bonusCommission,
      totalCommission: baseCommission + bonusCommission,
      applicableRules,
    };
  }

  /**
   * Check if a rule is applicable
   */
  private isRuleApplicable(
    rule: CommissionRule,
    tripAmount: number,
    driverLevel: string,
    tripData?: any
  ): boolean {
    if (!rule.conditions) {
      return true;
    }

    const { minAmount, maxAmount, driverLevel: allowedLevels, dayOfWeek, timeOfDay } = rule.conditions;

    // Check amount range
    if (minAmount && tripAmount < minAmount) {
      return false;
    }
    if (maxAmount && tripAmount > maxAmount) {
      return false;
    }

    // Check driver level
    if (allowedLevels && !allowedLevels.includes(driverLevel)) {
      return false;
    }

    // Check day of week
    if (dayOfWeek) {
      const today = new Date().getDay();
      if (!dayOfWeek.includes(today)) {
        return false;
      }
    }

    // Check time of day
    if (timeOfDay && tripData?.startTime) {
      const tripTime = new Date(tripData.startTime).getHours();
      const [startHour] = timeOfDay.start.split(':').map(Number);
      const [endHour] = timeOfDay.end.split(':').map(Number);

      if (tripTime < startHour || tripTime >= endHour) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate tiered commission
   */
  private calculateTieredCommission(amount: number, tieredRates: any): number {
    let commission = 0;

    if (Array.isArray(tieredRates)) {
      let remainingAmount = amount;

      for (const tier of tieredRates) {
        const tierAmount = Math.min(remainingAmount, tier.max - tier.min);
        commission += (tierAmount * tier.rate) / 100;
        remainingAmount -= tierAmount;

        if (remainingAmount <= 0) break;
      }
    }

    return commission;
  }

  /**
   * Calculate bonus commission
   */
  private async calculateBonusCommission(driverId: string, tripAmount: number): Promise<number> {
    try {
      // Check for active promotions or bonus programs
      const { data: bonuses, error } = await this.supabase
        .from('commission_bonuses')
        .select('*')
        .eq('driver_id', driverId)
        .eq('active', true)
        .gte('end_date', new Date().toISOString());

      if (error || !bonuses || bonuses.length === 0) {
        return 0;
      }

      let bonus = 0;
      for (const bonusProgram of bonuses) {
        if (bonusProgram.type === 'percentage') {
          bonus += (tripAmount * bonusProgram.value) / 100;
        } else if (bonusProgram.type === 'fixed') {
          bonus += bonusProgram.value;
        }
      }

      return bonus;
    } catch (error) {
      console.error('Bonus calculation error:', error);
      return 0;
    }
  }

  /**
   * Get driver level (for eligibility checks)
   */
  private async getDriverLevel(driverId: string): Promise<string> {
    try {
      const { data, error } = await this.supabase
        .from('drivers')
        .select('level')
        .eq('id', driverId)
        .single();

      if (error) {
        return 'standard';
      }

      return data?.level || 'standard';
    } catch {
      return 'standard';
    }
  }

  /**
   * Record commission payment
   */
  async recordCommission(driverId: string, tripId: string, amount: number): Promise<Commission> {
    try {
      const { data, error } = await this.supabase
        .from('commissions')
        .insert({
          driver_id: driverId,
          trip_id: tripId,
          amount,
          rate: (amount / (await this.getTripAmount(tripId))) * 100,
          type: 'trip',
          status: 'pending',
          created_at: new Date(),
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Record commission error:', error);
      throw error;
    }
  }

  /**
   * Get commission history
   */
  async getCommissionHistory(driverId: string, limit: number = 50): Promise<Commission[]> {
    try {
      const { data, error } = await this.supabase
        .from('commissions')
        .select('*')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Failed to fetch commission history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Commission history error:', error);
      return [];
    }
  }

  /**
   * Get commission statistics
   */
  async getCommissionStats(driverId: string, startDate?: Date, endDate?: Date): Promise<any> {
    try {
      let query = this.supabase.from('commissions').select('*').eq('driver_id', driverId);

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const commissions = data || [];
      const total = commissions.reduce((sum: number, c: any) => sum + c.amount, 0);
      const paid = commissions
        .filter((c: any) => c.status === 'paid')
        .reduce((sum: number, c: any) => sum + c.amount, 0);
      const pending = commissions
        .filter((c: any) => c.status === 'pending')
        .reduce((sum: number, c: any) => sum + c.amount, 0);

      return {
        totalCommissions: total,
        paidCommissions: paid,
        pendingCommissions: pending,
        count: commissions.length,
        average: commissions.length > 0 ? total / commissions.length : 0,
      };
    } catch (error) {
      console.error('Commission stats error:', error);
      throw error;
    }
  }

  /**
   * Update commission rules (admin only)
   */
  async updateCommissionRules(rules: CommissionRule[]): Promise<void> {
    try {
      for (const rule of rules) {
        const { error } = await this.supabase
          .from('commission_rules')
          .upsert({
            ...rule,
            updated_at: new Date(),
          });

        if (error) {
          throw error;
        }
      }

      // Clear cache to force reload
      this.rulesCacheTime = 0;
      await this.loadCommissionRules();
    } catch (error) {
      console.error('Update commission rules error:', error);
      throw error;
    }
  }

  /**
   * Get default commission rules
   */
  private getDefaultRules(): CommissionRule[] {
    return [
      {
        id: 'default-percentage',
        name: 'Default Percentage Commission',
        type: 'percentage',
        baseValue: 20,
        enabled: true,
        priority: 100,
      },
    ];
  }

  /**
   * Get trip amount (helper)
   */
  private async getTripAmount(tripId: string): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('trips')
        .select('fare')
        .eq('id', tripId)
        .single();

      if (error) {
        return 0;
      }

      return data?.fare || 0;
    } catch {
      return 0;
    }
  }
}

export const createCommissionService = (supabaseClient: any) => {
  return new CommissionService(supabaseClient);
};

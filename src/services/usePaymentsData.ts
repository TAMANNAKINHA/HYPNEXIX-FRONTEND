import { useCallback, useEffect, useState } from 'react';
import { paymentsApi, friendlyError, type PaymentFilters } from './paymentsApi';
import { getSocket } from './socket';
import type { Agent, Payment } from '../paymentTypes';

/** Loads payments + agents from the backend and refreshes on socket events and on demand. */
export function usePaymentsData(filters: PaymentFilters) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { status, missionId, from } = filters;

  const refresh = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([
        paymentsApi.list({ status, missionId, from }),
        paymentsApi.agents(),
      ]);
      setPayments([...p].sort((x, y) => y.createdAt - x.createdAt));
      setAgents(a);
      setError(null);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [status, missionId, from]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Live updates (events Person 2 should emit: payment_update, agent_update)
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const handler = () => { void refresh(); };
    s.on('payment_update', handler);
    s.on('agent_update', handler);
    return () => { s.off('payment_update', handler); s.off('agent_update', handler); };
  }, [refresh]);

  // While a revocation is pending, keep re-checking the real status from the backend.
  const revoking = agents.some((a) => a.status === 'REVOCATION_PENDING');
  useEffect(() => {
    if (!revoking) return;
    const t = setInterval(() => { void refresh(); }, 2000);
    return () => clearInterval(t);
  }, [revoking, refresh]);

  return { payments, agents, loading, error, refresh };
}

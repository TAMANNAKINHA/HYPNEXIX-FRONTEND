import { useState } from 'react';
import { usePaymentsData } from '../services/usePaymentsData';
import { USE_MOCK } from '../services/paymentsApi';
import type { PaymentStatus } from '../paymentTypes';
import { KillSwitchPanel } from './KillSwitchPanel';
import { SimulatorPanel } from './SimulatorPanel';
import { PaymentHistory } from './PaymentHistory';

export function PaymentsView() {
  const [status, setStatus] = useState<PaymentStatus | ''>('');
  const [missionId, setMissionId] = useState('');
  const [from, setFrom] = useState('');
  const { payments, agents, loading, error, refresh } = usePaymentsData({ status, missionId, from });

  return (
    <div className="space-y-4">
      {USE_MOCK && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-[12px] text-warning">
          Demo data: this page is using mock payments, not the real backend. Set VITE_USE_MOCK=false in .env to connect.
        </div>
      )}
      <KillSwitchPanel agents={agents} onChanged={refresh} />
      <SimulatorPanel onSubmitted={refresh} />
      <PaymentHistory
        payments={payments} loading={loading} loadError={error}
        status={status} missionId={missionId} from={from}
        setStatus={setStatus} setMissionId={setMissionId} setFrom={setFrom}
        onChanged={refresh}
      />
    </div>
  );
}

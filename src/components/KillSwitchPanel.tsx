import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { paymentsApi, friendlyError } from '../services/paymentsApi';
import type { Agent } from '../paymentTypes';
import { ConfirmDialog, Panel, StatusBadge, inputCls, labelCls, shortHash } from './PaymentsUi';

export function KillSwitchPanel({ agents, onChanged }: { agents: Agent[]; onChanged: () => Promise<void> }) {
  const [target, setTarget] = useState<Agent | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => { setTarget(null); setReason(''); setError(null); };

  const confirm = async () => {
    if (!target || busy) return;
    setBusy(true);
    setError(null);
    try {
      await paymentsApi.killAgent(target.agentId, reason.trim());
      await onChanged(); // always re-read the real status from the backend
      close();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="AI Agent Kill Switch" subtitle="Emergency-disable an agent so it can no longer spend from its mission wallets.">
      {agents.length === 0 && <p className="text-[13px] text-ink-faint">No agents found.</p>}
      <div className="space-y-3">
        {agents.map((a) => (
          <div key={a.agentId} className="rounded-xl border border-gold/10 bg-bg-card/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[14px] font-semibold text-white">{a.name}</div>
                <div className="text-[11px] text-ink-faint">Mission wallets affected: {a.missionIds.join(', ') || 'none'}</div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={a.status} />
                <button
                  onClick={() => setTarget(a)}
                  disabled={a.status !== 'ACTIVE'}
                  className="flex items-center gap-2 rounded-lg bg-error px-4 py-2 text-[12px] font-bold text-white hover:bg-error/80 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ShieldAlert className="h-4 w-4" /> Emergency disable
                </button>
              </div>
            </div>
            {a.status === 'REVOCATION_PENDING' && (
              <p className="mt-3 text-[12px] text-warning">Revocation is in progress. Waiting for the blockchain to confirm…</p>
            )}
            {a.status === 'DISABLED' && (
              <p className="mt-3 text-[12px] text-ink-dim">
                Agent disabled. New payments are blocked.{a.revocationTxHash && ` Revocation tx: ${shortHash(a.revocationTxHash)}`}
              </p>
            )}
            {a.status === 'ERROR' && <p className="mt-3 text-[12px] text-error">Revocation failed: {a.lastError || 'unknown error'}. The agent may still be able to pay.</p>}
            {a.inFlightTxHashes.length > 0 && (
              <p className="mt-2 text-[12px] text-warning">
                {a.inFlightTxHashes.length} transaction(s) already submitted and may still complete: {a.inFlightTxHashes.map(shortHash).join(', ')}
              </p>
            )}
          </div>
        ))}
      </div>

      {target && (
        <ConfirmDialog
          title={`Disable “${target.name}”?`}
          confirmLabel="Disable agent"
          danger
          busy={busy}
          disabled={reason.trim().length < 3}
          error={error}
          onConfirm={confirm}
          onCancel={close}
        >
          <p>This will block new payments from this agent on these mission wallets: <b className="text-white">{target.missionIds.join(', ') || 'none'}</b>.</p>
          <p className="text-warning">Warning: transactions that were already submitted may still complete. A kill switch cannot undo a confirmed transaction.</p>
          <div>
            <label className={labelCls} htmlFor="kill-reason">Reason (required)</label>
            <input id="kill-reason" className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. suspicious payment activity" />
          </div>
        </ConfirmDialog>
      )}
    </Panel>
  );
}

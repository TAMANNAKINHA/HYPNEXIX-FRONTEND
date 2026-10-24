import { useState } from 'react';
import { RefreshCw, Snowflake } from 'lucide-react';
import { paymentsApi, friendlyError } from '../services/paymentsApi';
import { useAegis } from '@/orchestrator';
import * as missionApi from '../services/api';
import { ALL_PAYMENT_STATUSES, type Payment, type PaymentStatus } from '../paymentTypes';
import { ConfirmDialog, ErrorBanner, Panel, Spinner, StatusBadge, inputCls, labelCls, shortHash } from './PaymentsUi';

type Pending = { payment: Payment; action: 'approve' | 'reject' | 'freeze' } | { missionFreeze: string };

interface Props {
  payments: Payment[];
  loading: boolean;
  loadError: string | null;
  status: PaymentStatus | '';
  missionId: string;
  from: string;
  setStatus: (s: PaymentStatus | '') => void;
  setMissionId: (s: string) => void;
  setFrom: (s: string) => void;
  onChanged: () => Promise<void>;
}

export function PaymentHistory(p: Props) {
  const { state } = useAegis();
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => { setPending(null); setReason(''); setError(null); };

  const confirm = async () => {
    if (!pending || busy) return;
    setBusy(true); setError(null);
    try {
      if ('missionFreeze' in pending) {
        await missionApi.freezeWallet(pending.missionFreeze); // existing backend endpoint
      } else {
        const { payment, action } = pending;
        if (action === 'approve') await paymentsApi.approve(payment.id, reason.trim() || undefined);
        if (action === 'reject') await paymentsApi.reject(payment.id, reason.trim());
        if (action === 'freeze') await paymentsApi.freeze(payment.id, reason.trim() || undefined);
      }
      await p.onChanged();
      close();
    } catch (e) {
      setError(friendlyError(e));
      await p.onChanged(); // the payment may have changed state while the dialog was open
    } finally {
      setBusy(false);
    }
  };

  const title = !pending ? '' : 'missionFreeze' in pending ? 'Freeze whole mission?'
    : pending.action === 'approve' ? 'Approve this payment?'
    : pending.action === 'reject' ? 'Reject this payment?' : 'Freeze this payment?';

  return (
    <Panel title="Payment Queue & History" subtitle="Live from the backend. Statuses come from the server, never guessed by this page.">
      <ErrorBanner message={p.loadError} />
      <div className="mb-4 grid gap-3 md:grid-cols-5">
        <div>
          <label className={labelCls} htmlFor="f-status">Status</label>
          <select id="f-status" className={inputCls} value={p.status} onChange={(e) => p.setStatus(e.target.value as PaymentStatus | '')}>
            <option value="">All</option>
            {ALL_PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="f-mission">Mission wallet</label>
          <select id="f-mission" className={inputCls} value={p.missionId} onChange={(e) => p.setMissionId(e.target.value)}>
            <option value="">All</option>
            {state.missions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            {state.missions.length === 0 && <option value="m1">m1 (demo)</option>}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="f-from">From date</label>
          <input id="f-from" type="date" className={inputCls} value={p.from} onChange={(e) => p.setFrom(e.target.value)} />
        </div>
        <div className="flex items-end gap-2 md:col-span-2">
          <button onClick={() => void p.onChanged()} className="flex items-center gap-2 rounded-lg border border-gold/30 px-3 py-2 text-[12px] text-ink-dim hover:text-white">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button
            onClick={() => { p.setStatus(''); p.setMissionId(''); p.setFrom(''); }}
            disabled={!p.status && !p.missionId && !p.from}
            className="rounded-lg border border-gold/30 px-3 py-2 text-[12px] text-ink-dim hover:text-white disabled:cursor-not-allowed disabled:opacity-40">
            Clear filters
          </button>
          <button
            onClick={() => p.missionId && setPending({ missionFreeze: p.missionId })}
            disabled={!p.missionId}
            title={p.missionId ? '' : 'Pick a mission wallet first'}
            className="flex items-center gap-2 rounded-lg border border-cyan-400/40 px-3 py-2 text-[12px] text-cyan-300 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-40">
            <Snowflake className="h-4 w-4" /> Freeze whole mission
          </button>
        </div>
      </div>

      {p.loading ? (
        <div className="flex items-center gap-2 text-[13px] text-ink-faint"><Spinner /> Loading payments…</div>
      ) : p.payments.length === 0 ? (
        <p className="text-[13px] text-ink-faint">No payments match these filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-[12px]">
            <thead className="text-[10px] uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="py-2 pr-3">Status</th><th className="pr-3">Amount</th><th className="pr-3">Recipient</th>
                <th className="pr-3">Created</th><th className="pr-3">Updated</th><th className="pr-3">Tx hash</th>
                <th className="pr-3">Reason</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {p.payments.map((pay) => (
                <tr key={pay.id} className="border-t border-gold/10 align-top">
                  <td className="py-3 pr-3">
                    <StatusBadge status={pay.status} />
                    {pay.duplicateWarning && <div className="mt-1 max-w-[180px] text-[11px] text-warning">⚠ {pay.duplicateWarning}</div>}
                  </td>
                  <td className="pr-3 text-white">{pay.amount} {pay.asset}</td>
                  <td className="pr-3 font-mono text-ink-dim">{shortHash(pay.recipient)}</td>
                  <td className="pr-3 text-ink-dim">{new Date(pay.createdAt).toLocaleString()}</td>
                  <td className="pr-3 text-ink-dim">{new Date(pay.updatedAt).toLocaleString()}</td>
                  <td className="pr-3 font-mono">
                    {pay.txHash ? (pay.explorerUrl
                      ? <a href={pay.explorerUrl} target="_blank" rel="noreferrer" className="text-gold-soft underline">{shortHash(pay.txHash)}</a>
                      : <span className="text-ink-dim" title="No verified explorer configured">{shortHash(pay.txHash)}</span>)
                      : <span className="text-ink-faint">—</span>}
                  </td>
                  <td className="pr-3 text-ink-dim">{pay.reason || '—'}</td>
                  <td>
                    {pay.status === 'PENDING' ? (
                      <div className="flex flex-wrap gap-1.5">
                        <button onClick={() => setPending({ payment: pay, action: 'approve' })} className="rounded bg-success/20 px-2 py-1 text-success hover:bg-success/30">Approve</button>
                        <button onClick={() => setPending({ payment: pay, action: 'reject' })} className="rounded bg-error/20 px-2 py-1 text-error hover:bg-error/30">Reject</button>
                        <button onClick={() => setPending({ payment: pay, action: 'freeze' })} className="rounded bg-cyan-500/20 px-2 py-1 text-cyan-300 hover:bg-cyan-500/30">Freeze</button>
                      </div>
                    ) : pay.status === 'SUBMITTED' ? (
                      <span className="text-[11px] text-warning">Already submitted — cannot be reliably cancelled</span>
                    ) : <span className="text-ink-faint">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pending && (
        <ConfirmDialog
          title={title}
          confirmLabel={'missionFreeze' in pending ? 'Freeze mission' : pending.action === 'approve' ? 'Approve' : pending.action === 'reject' ? 'Reject' : 'Freeze'}
          danger={'missionFreeze' in pending || pending.action !== 'approve'}
          busy={busy}
          disabled={!('missionFreeze' in pending) && pending.action === 'reject' && reason.trim().length < 3}
          error={error}
          onConfirm={confirm}
          onCancel={close}
        >
          {'missionFreeze' in pending ? (
            <p>All activity on this mission wallet will be paused. Payments already submitted to the blockchain may still complete.</p>
          ) : (
            <>
              <p>{pending.payment.amount} {pending.payment.asset} to <span className="font-mono">{shortHash(pending.payment.recipient)}</span></p>
              {pending.action === 'approve' && <p>The backend validates the payment again before sending, so approval does not guarantee execution.</p>}
              <div>
                <label className={labelCls} htmlFor="act-reason">Reason{pending.action === 'reject' ? ' (required)' : ' (optional)'}</label>
                <input id="act-reason" className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            </>
          )}
        </ConfirmDialog>
      )}
    </Panel>
  );
}

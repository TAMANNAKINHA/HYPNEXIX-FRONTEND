import { useRef, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { useAegis } from '@/orchestrator';
import { paymentsApi, friendlyError } from '../services/paymentsApi';
import type { SimulationResult } from '../paymentTypes';
import { ErrorBanner, Panel, Spinner, inputCls, labelCls } from './PaymentsUi';

const newRequestId = () => `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export function SimulatorPanel({ onSubmitted }: { onSubmitted: () => Promise<void> }) {
  const { state } = useAegis();
  const [missionId, setMissionId] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // One idempotency key per payment attempt: retries reuse it so the backend returns the same payment.
  const requestId = useRef(newRequestId());

  const edit = (setter: (v: string) => void) => (e: { target: { value: string } }) => {
    setter(e.target.value);
    setResult(null); // old preview no longer matches the form
    setNotice(null);
    requestId.current = newRequestId();
  };

  const formOk = missionId !== '' && recipient.trim() !== '' && Number(amount) > 0;

  const simulate = async () => {
    if (!formOk || simulating) return;
    setSimulating(true); setError(null); setNotice(null);
    try {
      setResult(await paymentsApi.simulate({ missionId, recipient: recipient.trim(), amount: amount.trim() }));
    } catch (e) {
      setResult(null);
      setError(friendlyError(e));
    } finally {
      setSimulating(false);
    }
  };

  const proceed = async () => {
    if (!result?.canProceed || submitting) return;
    setSubmitting(true); setError(null);
    try {
      const res = await paymentsApi.submit({
        requestId: requestId.current, missionId, recipient: recipient.trim(), amount: amount.trim(),
        simulationId: result.simulationId,
      });
      setNotice(
        res.duplicate
          ? `Duplicate detected: ${res.duplicateWarning ?? 'this request already exists.'} Showing the existing payment in the queue.`
          : `Payment request created (status ${res.payment.status}). ${res.duplicateWarning ? 'Warning: ' + res.duplicateWarning + ' ' : ''}It still needs approval and a fresh validation before anything is sent.`,
      );
      setResult(null);
      requestId.current = newRequestId();
      await onSubmitted();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Panel title="Shadow Transaction Simulator" subtitle="Preview a payment against current policies. Nothing is sent to the blockchain.">
      <ErrorBanner message={error} />
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className={labelCls} htmlFor="sim-mission">Mission wallet</label>
          <select id="sim-mission" className={inputCls} value={missionId} onChange={edit(setMissionId)}>
            <option value="">Select…</option>
            {state.missions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            {state.missions.length === 0 && <option value="m1">m1 (demo)</option>}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="sim-recipient">Recipient address</label>
          <input id="sim-recipient" className={inputCls} value={recipient} onChange={edit(setRecipient)} placeholder="0x…" />
        </div>
        <div>
          <label className={labelCls} htmlFor="sim-amount">Amount</label>
          <input id="sim-amount" className={inputCls} inputMode="decimal" value={amount} onChange={edit(setAmount)} placeholder="0.00" />
        </div>
      </div>
      <button onClick={simulate} disabled={!formOk || simulating}
        className="mt-4 flex items-center gap-2 rounded-lg bg-gold/90 px-4 py-2 text-[13px] font-semibold text-bg hover:bg-gold disabled:cursor-not-allowed disabled:opacity-50">
        {simulating ? <Spinner /> : <FlaskConical className="h-4 w-4" />} Simulate Payment
      </button>

      {notice && <p className="mt-4 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-[12px] text-gold-soft">{notice}</p>}

      {result && (
        <div className="mt-4 rounded-xl border border-dashed border-gold/40 bg-bg-card/60 p-4">
          <div className="mb-3 inline-block rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold tracking-widest text-ink-dim">
            SIMULATION ONLY — NOT AN ACTUAL TRANSACTION
          </div>
          <dl className="grid gap-3 text-[13px] sm:grid-cols-3">
            <div><dt className={labelCls}>Estimated fee</dt><dd className="text-white">{result.estimatedFee}</dd></div>
            <div><dt className={labelCls}>Budget left after payment</dt><dd className="text-white">{result.remainingBudgetAfterPayment}</dd></div>
            <div><dt className={labelCls}>Result</dt>
              <dd className={result.canProceed ? 'text-success' : 'text-error'}>{result.canProceed ? 'Can proceed' : 'Blocked by policy'}</dd></div>
          </dl>
          {result.violations.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-[12px] text-error">
              {result.violations.map((v) => <li key={v}>Violation: {v}</li>)}
            </ul>
          )}
          {result.warnings.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-[12px] text-warning">
              {result.warnings.map((w) => <li key={w}>Warning: {w}</li>)}
            </ul>
          )}
          <p className="mt-4 text-[12px] text-ink-faint">
            Proceeding creates a payment request that needs approval. Everything is validated again at execution time, because budget and permissions can change after a preview.
          </p>
          <button onClick={proceed} disabled={!result.canProceed || submitting}
            className="mt-3 flex items-center gap-2 rounded-lg border border-gold/50 px-4 py-2 text-[13px] font-semibold text-gold-soft hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40">
            {submitting && <Spinner />} Proceed to approval
          </button>
        </div>
      )}
    </Panel>
  );
}

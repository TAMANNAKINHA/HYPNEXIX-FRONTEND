import type {
  Agent, Payment, PaymentStatus, SimulateRequest, SimulationResult,
  SubmitPaymentRequest, SubmitPaymentResponse,
} from '../paymentTypes';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
// Mock mode is ON unless you set VITE_USE_MOCK=false in .env (so the UI runs before Person 2 finishes).
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

export class ApiError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const FRIENDLY: Record<string, string> = {
  BACKEND_UNAVAILABLE: 'Cannot reach the backend. Check that it is running, then try again.',
  INSUFFICIENT_BUDGET: 'This mission does not have enough budget left for that payment.',
  RECIPIENT_NOT_ALLOWED: 'That recipient is not on the mission allowlist.',
  INVALID_TRANSITION: 'That action is not allowed for the payment’s current status.',
  ALREADY_SUBMITTED: 'This payment was already submitted to the blockchain and cannot be reliably cancelled.',
  AGENT_DISABLED: 'This agent has been disabled, so new payments are blocked.',
  APPROVAL_EXPIRED: 'The approval window expired. Please request a new payment.',
  UNAUTHORIZED: 'You are not authorized to do that.',
  VALIDATION_ERROR: 'Some details are invalid. Please check the form.',
};

export function friendlyError(e: unknown): string {
  if (e instanceof ApiError) return (e.code && FRIENDLY[e.code]) || e.message;
  if (e instanceof Error) {
    if (/failed to fetch|load failed|networkerror/i.test(e.message)) return FRIENDLY.BACKEND_UNAVAILABLE;
    return e.message;
  }
  return 'Something went wrong. Please try again.';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch {
    throw new ApiError(FRIENDLY.BACKEND_UNAVAILABLE, 'BACKEND_UNAVAILABLE');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(body?.error || body?.message || `Request failed (${res.status})`, body?.code, res.status);
  }
  return body as T;
}

const post = <T,>(path: string, data: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(data) });

export interface PaymentFilters { status?: PaymentStatus | ''; missionId?: string; from?: string }

// ---------------- REAL BACKEND (contract proposed to Person 2) ----------------
const real = {
  simulate: (r: SimulateRequest) => post<SimulationResult>('/api/payments/simulate', r),
  submit: (r: SubmitPaymentRequest) => post<SubmitPaymentResponse>('/api/payments', r),
  list: async (f: PaymentFilters) => {
    const q = new URLSearchParams();
    if (f.status) q.set('status', f.status);
    if (f.missionId) q.set('missionId', f.missionId);
    if (f.from) q.set('from', f.from);
    return (await request<{ payments: Payment[] }>(`/api/payments?${q}`)).payments;
  },
  approve: (id: string, reason?: string) => post<{ payment: Payment }>(`/api/payments/${id}/approve`, { reason }),
  reject: (id: string, reason: string) => post<{ payment: Payment }>(`/api/payments/${id}/reject`, { reason }),
  freeze: (id: string, reason?: string) => post<{ payment: Payment }>(`/api/payments/${id}/freeze`, { reason }),
  agents: async () => (await request<{ agents: Agent[] }>('/api/agents')).agents,
  killAgent: (agentId: string, reason: string) =>
    post<{ agent: Agent }>(`/api/agents/${agentId}/kill-switch`, { reason }),
};

// ---------------- MOCK (demo only, never touches a chain) ----------------
const wait = (ms = 400) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now();
const ALLOWLIST = ['0xAWS000000000000000000000000000000000001', '0xGITHUB0000000000000000000000000000002'];
let mockBudgetLeft = 18;
let mockPayments: Payment[] = [
  { id: 'pay_1', requestId: 'req_1', missionId: 'm1', recipient: ALLOWLIST[0], amount: '2.00', asset: 'ETH',
    status: 'PENDING', createdAt: now() - 600000, updatedAt: now() - 600000, history: [] },
  { id: 'pay_2', requestId: 'req_2', missionId: 'm1', recipient: ALLOWLIST[1], amount: '1.50', asset: 'ETH',
    status: 'SUBMITTED', createdAt: now() - 3600000, updatedAt: now() - 3000000,
    txHash: '0x9f2c' + 'a'.repeat(58), history: [] },
  { id: 'pay_3', requestId: 'req_3', missionId: 'm1', recipient: ALLOWLIST[0], amount: '0.75', asset: 'ETH',
    status: 'CONFIRMED', createdAt: now() - 86400000, updatedAt: now() - 86000000,
    txHash: '0x71be' + 'b'.repeat(58), history: [] },
  { id: 'pay_4', requestId: 'req_4', missionId: 'm1', recipient: '0xUNKNOWN0000000000000000000000000000009', amount: '5.00',
    asset: 'ETH', status: 'REJECTED', reason: 'Recipient not on allowlist', createdAt: now() - 172800000,
    updatedAt: now() - 172000000, history: [] },
];
let mockAgents: Agent[] = [
  { agentId: 'agent_1', name: 'Procurement Agent', missionIds: ['m1'], status: 'ACTIVE',
    inFlightTxHashes: ['0x9f2c' + 'a'.repeat(58)], updatedAt: now() },
];

const mock: typeof real = {
  async simulate(r) {
    await wait();
    const amt = Number(r.amount);
    const violations: string[] = [];
    const warnings: string[] = [];
    if (!Number.isFinite(amt) || amt <= 0) violations.push('Amount must be greater than zero');
    if (!ALLOWLIST.includes(r.recipient)) violations.push('Recipient policy failed: not on the allowlist');
    if (amt > mockBudgetLeft) violations.push('Insufficient remaining budget');
    if (amt > 0 && amt > mockBudgetLeft * 0.5) warnings.push('This payment uses more than half of the remaining budget');
    return {
      simulationId: `preview-${now()}`,
      canProceed: violations.length === 0,
      estimatedFee: '0.002',
      remainingBudgetAfterPayment: (mockBudgetLeft - (amt || 0)).toFixed(2),
      warnings, violations, broadcasted: false,
    };
  },
  async submit(r) {
    await wait();
    const existing = mockPayments.find((p) => p.requestId === r.requestId);
    if (existing) return { payment: existing, duplicate: true, duplicateWarning: 'This request was already submitted; returning the existing payment.' };
    const similar = mockPayments.find((p) => p.recipient === r.recipient && p.amount === r.amount && p.status !== 'REJECTED');
    const p: Payment = {
      id: `pay_${now()}`, requestId: r.requestId, missionId: r.missionId, recipient: r.recipient, amount: r.amount,
      asset: 'ETH', status: 'PENDING', createdAt: now(), updatedAt: now(),
      duplicateWarning: similar ? 'A similar payment (same recipient and amount) already exists.' : undefined,
      history: [],
    };
    mockPayments = [p, ...mockPayments];
    return { payment: p, duplicate: false, duplicateWarning: p.duplicateWarning };
  },
  async list(f) {
    await wait(200);
    return mockPayments.filter((p) =>
      (!f.status || p.status === f.status) &&
      (!f.missionId || p.missionId === f.missionId) &&
      (!f.from || p.createdAt >= new Date(f.from).getTime()));
  },
  async approve(id, reason) { return mockTransition(id, 'PENDING', 'APPROVED', reason); },
  async reject(id, reason) { return mockTransition(id, 'PENDING', 'REJECTED', reason); },
  async freeze(id, reason) { return mockTransition(id, 'PENDING', 'FROZEN', reason); },
  async agents() { await wait(150); return mockAgents; },
  async killAgent(agentId, reason) {
    await wait();
    const a = mockAgents.find((x) => x.agentId === agentId);
    if (!a) throw new ApiError('Agent not found', 'NOT_FOUND', 404);
    a.status = 'REVOCATION_PENDING'; a.updatedAt = now();
    console.info('mock kill reason:', reason);
    setTimeout(() => { a.status = 'DISABLED'; a.revocationTxHash = '0xrev' + 'c'.repeat(60); a.updatedAt = now(); }, 3000);
    return { agent: a };
  },
};

async function mockTransition(id: string, from: PaymentStatus, to: PaymentStatus, reason?: string) {
  await wait();
  const p = mockPayments.find((x) => x.id === id);
  if (!p) throw new ApiError('Payment not found', 'NOT_FOUND', 404);
  if (p.status === 'SUBMITTED' || p.status === 'CONFIRMED') throw new ApiError('Already submitted', 'ALREADY_SUBMITTED', 409);
  if (p.status !== from) throw new ApiError('Invalid transition', 'INVALID_TRANSITION', 409);
  p.status = to; p.reason = reason; p.updatedAt = now();
  return { payment: { ...p } };
}

export const paymentsApi = USE_MOCK ? mock : real;

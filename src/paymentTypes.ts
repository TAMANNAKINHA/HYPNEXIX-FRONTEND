// Shapes of the Person 2 backend API. Agree on these with Person 2 before changing.
export type PaymentStatus =
  | 'PENDING' | 'APPROVED' | 'SUBMITTED' | 'CONFIRMED'
  | 'REJECTED' | 'FROZEN' | 'EXPIRED' | 'FAILED';

export const ALL_PAYMENT_STATUSES: PaymentStatus[] = [
  'PENDING', 'APPROVED', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'REJECTED', 'FROZEN', 'EXPIRED',
];

export interface PaymentEvent {
  status: PaymentStatus;
  actor: string;
  timestamp: number;
  reason?: string;
}

export interface Payment {
  id: string;
  requestId: string;          // idempotency key
  missionId: string;
  recipient: string;
  amount: string;             // string on purpose: never do money math in floats
  asset: string;
  status: PaymentStatus;
  createdAt: number;
  updatedAt: number;
  txHash?: string;
  explorerUrl?: string;       // only present when backend has a verified network config
  reason?: string;            // approval / rejection / failure reason
  duplicateWarning?: string;  // set by backend when it suspects a duplicate
  history?: PaymentEvent[];
}

export interface SimulationResult {
  simulationId: string;
  canProceed: boolean;
  estimatedFee: string;
  remainingBudgetAfterPayment: string;
  warnings: string[];
  violations: string[];
  broadcasted: boolean;       // must always be false
}

export interface SimulateRequest {
  missionId: string;
  recipient: string;
  amount: string;
}

export interface SubmitPaymentRequest extends SimulateRequest {
  requestId: string;          // idempotency key; reuse it on retry
  simulationId?: string;
}

export interface SubmitPaymentResponse {
  payment: Payment;
  duplicate: boolean;         // true if backend returned an existing payment
  duplicateWarning?: string;
}

export type AgentStatus = 'ACTIVE' | 'REVOCATION_PENDING' | 'DISABLED' | 'ERROR';

export interface Agent {
  agentId: string;
  name: string;
  missionIds: string[];       // mission wallets this agent can spend from
  status: AgentStatus;
  inFlightTxHashes: string[]; // already submitted, may still confirm
  revocationTxHash?: string;
  lastError?: string;
  updatedAt: number;
}

const rawNormalize = (value) => String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

const RESCUE_STATUS_ALIASES = {
  new: 'pending',
  open: 'pending',
  unassigned: 'pending',
  completed: 'rescued',
  resolved: 'rescued',
  canceled: 'cannot_complete',
  cancelled: 'cannot_complete',
};

const TRANSFER_STATUS_ALIASES = {
  accepted: 'approved',
};

const ADOPTION_STATUS_ALIASES = {
  pending: 'requested',
};

export const normalizeRescueStatus = (value) => {
  const normalized = rawNormalize(value);
  return RESCUE_STATUS_ALIASES[normalized] || normalized;
};

export const normalizeTransferStatus = (value) => {
  const normalized = rawNormalize(value);
  return TRANSFER_STATUS_ALIASES[normalized] || normalized;
};

export const normalizeAdoptionStatus = (value) => {
  const normalized = rawNormalize(value);
  return ADOPTION_STATUS_ALIASES[normalized] || normalized;
};

export const normalizeStatus = rawNormalize;

export const RESCUE_COMPLETED_STATUSES = ['rescued'];
export const RESCUE_IN_PROGRESS_STATUSES = ['in_progress', 'on_the_way', 'arrived', 'pending_verification'];
export const RESCUE_OPEN_STATUSES = ['active', 'pending'];
export const RESCUE_ACCEPTABLE_STATUSES = ['active', 'pending', 'cannot_complete', ''];

export const isRescueCompletedStatus = (value) => RESCUE_COMPLETED_STATUSES.includes(normalizeRescueStatus(value));
export const isRescueInProgressStatus = (value) => RESCUE_IN_PROGRESS_STATUSES.includes(normalizeRescueStatus(value));
export const isRescueOpenStatus = (value) => RESCUE_OPEN_STATUSES.includes(normalizeRescueStatus(value));
export const isRescueAcceptableStatus = (value) => RESCUE_ACCEPTABLE_STATUSES.includes(normalizeRescueStatus(value));

export const TRANSFER_ACTIVE_STATUSES = ['approved', 'in_transit', 'arrived_at_shelter'];
export const TRANSFER_COMPLETED_STATUSES = ['completed'];

export const isTransferActiveStatus = (value) => TRANSFER_ACTIVE_STATUSES.includes(normalizeTransferStatus(value));
export const isTransferCompletedStatus = (value) => TRANSFER_COMPLETED_STATUSES.includes(normalizeTransferStatus(value));

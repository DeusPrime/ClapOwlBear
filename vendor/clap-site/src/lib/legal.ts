import policy from "../../server/legal-policy.json";
export type LegalPolicy = typeof policy & { ready: boolean; registrationOpen?: boolean };
export const DEFAULT_LEGAL_POLICY: LegalPolicy = { ...policy, ready: false, registrationOpen: false };
export const legalAcceptance = (accepted: boolean, policy?: LegalPolicy) => ({ acceptedTerms: accepted, acknowledgedPrivacy: accepted, termsVersion: policy?.termsVersion, privacyVersion: policy?.privacyVersion });

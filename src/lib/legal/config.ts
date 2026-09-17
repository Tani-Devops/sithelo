// ====================================================================
// Central legal/company configuration for the Terms and Privacy pages.
//
// These values (registered company name, registration number, physical
// address, governing law, legal contact email) are not present anywhere
// in this repository, and this file does not invent them. Each reads
// from an environment variable and falls back to honest, non-fabricated
// prose when unset, so the public pages never show a bracketed
// "[PLACEHOLDER]" or a developer note, but also never assert a legal
// fact nobody has confirmed.
//
// OWNER INPUT REQUIRED BEFORE PUBLIC LAUNCH: set the corresponding
// environment variables (see .env.example) once the registered entity,
// address, governing-law position and a monitored contact mailbox exist.
// Until then, the fallbacks below are what real visitors will see.
// ====================================================================

export const LEGAL_CONFIG = {
  companyName: process.env.NEXT_PUBLIC_LEGAL_COMPANY_NAME || null,
  registrationNumber: process.env.NEXT_PUBLIC_LEGAL_REGISTRATION_NUMBER || null,
  address: process.env.NEXT_PUBLIC_LEGAL_ADDRESS || null,
  governingLaw: process.env.NEXT_PUBLIC_LEGAL_GOVERNING_LAW || null,
  contactEmail: process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL || null,
  privacyContactEmail: process.env.NEXT_PUBLIC_LEGAL_PRIVACY_CONTACT_EMAIL || process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL || null,
  lastUpdated: process.env.NEXT_PUBLIC_LEGAL_LAST_UPDATED || null,
} as const;

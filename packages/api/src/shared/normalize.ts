export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeCi(ci: string): string {
  return ci.replace(/\s+/g, '').trim();
}

export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeParticipant(input: {
  firstName: string;
  lastName: string;
  ci: string;
  email: string;
}): { firstName: string; lastName: string; ci: string; email: string } {
  return {
    firstName: normalizeName(input.firstName),
    lastName: normalizeName(input.lastName),
    ci: normalizeCi(input.ci),
    email: normalizeEmail(input.email),
  };
}

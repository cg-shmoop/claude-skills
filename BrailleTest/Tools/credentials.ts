/**
 * Test account credentials for authenticated site testing.
 * Add your own site's test accounts here, or supply them via
 * environment variables (BRAILLETEST_USERNAME / BRAILLETEST_PASSWORD).
 * Only use limited test accounts — never production credentials.
 */

export interface TestCredentials {
  username: string;
  password: string;
  loginUrl: string;
  domain: string;
}

export const TEST_CREDENTIALS: Record<string, TestCredentials> = {
  // Example entry — replace with your own test site:
  // 'app.example.com': {
  //   username: process.env.BRAILLETEST_USERNAME ?? 'testuser',
  //   password: process.env.BRAILLETEST_PASSWORD ?? '',
  //   loginUrl: 'https://app.example.com/login',
  //   domain: 'app.example.com',
  // },
};

/**
 * Get credentials for a domain, or null if no test account exists.
 */
export function getCredentials(domain: string): TestCredentials | null {
  return TEST_CREDENTIALS[domain] ?? null;
}

/**
 * Check if a domain requires authentication.
 */
export function requiresAuth(domain: string): boolean {
  return domain in TEST_CREDENTIALS;
}

/**
 * Validate that critical environment variables are set before the server starts.
 * Exits with code 1 if any required vars are missing.
 */
export function validateEnv(): void {
  const required: string[] = ['DATABASE_URL', 'JWT_SECRET', 'COOKIE_SECRET'];

  const prodRequired: string[] = [
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'CLIENT_URL',
  ];

  const isProd = process.env.NODE_ENV === 'production';
  const allRequired = isProd ? [...required, ...prodRequired] : required;

  const missing = allRequired.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('ERROR: Missing required environment variables:');
    for (const key of missing) {
      console.error(`  - ${key}`);
    }
    if (isProd) {
      console.error('Production mode requires all listed variables.');
    }
    process.exit(1);
  }
}

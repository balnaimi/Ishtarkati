/** Whether an account has no login identity filled (email, username, or phone). */
export function isAccountIdentityIncomplete(s: {
  account_label?: string | null;
  login_username?: string | null;
  login_phone?: string | null;
}): boolean {
  return (
    !s.account_label?.trim() && !s.login_username?.trim() && !s.login_phone?.trim()
  );
}

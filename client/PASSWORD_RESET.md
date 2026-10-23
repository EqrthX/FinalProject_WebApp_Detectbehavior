# Password reset UI

## Routes
- `/forgot-password`: request an email recovery link; linked from the login page.
- `/reset-password`: set a new password after opening a valid recovery email.

Uses the existing Supabase browser client, with no new FastAPI endpoints or service-role key in the browser. The current client uses the default implicit recovery flow. Keep the recovery email template pointing at Supabase's confirmation URL so it validates the link before redirecting to the app.

## Supabase setup (owner action)
1. In Authentication → URL Configuration, allow the exact frontend redirect URL, for example `http://localhost:5173/reset-password` locally and `https://YOUR-FRONTEND/reset-password` in deployment. Use the actual frontend port/origin, not the API origin.
2. Set Site URL to the intended frontend. Confirm email delivery/SMTP settings and password policy for your project. The UI enforces a minimum of 8 characters; Supabase may enforce stronger rules and remains authoritative.
3. Ensure production hosting serves the SPA for `/forgot-password` and `/reset-password` deep links.
4. Recovery does not change teacher/admin roles. It updates the Supabase Auth password only.

## Manual acceptance checks (use a test account)
- Login page → forgot password; check mobile width, keyboard focus, invalid/empty email.
- Submit a test email: pending button, neutral confirmation, resend countdown, change email, rate-limit/network failure.
- Open a fresh email link: password form appears. Direct navigation without recovery context or an expired link shows a request-new-link action.
- Check short password, mismatching confirmation, show/hide password, repeated clicks and password-policy rejection.
- Successful update shows confirmation and a login link, clears app login fields and requests local recovery-session sign-out. No automatic role assignment/login.
- Sign in with the new password; the old password should fail.

Recovery context is bound to the SDK session's user ID and expiry in tab-scoped sessionStorage so refresh in the same tab can continue. This is a UI flow gate, not an authorization mechanism: Supabase validates the session and the password update. No passwords are stored in browser storage or logged. Client resend cooldown improves UX only; server rate limits remain authoritative.

References:
- https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
- https://supabase.com/docs/reference/javascript/auth-updateuser
- https://supabase.com/docs/guides/auth/redirect-urls

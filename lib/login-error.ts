export function getFriendlyLoginError(error: string | null | undefined) {
  if (!error) return "Login failed. Please try again.";

  if (error === "CredentialsSignin") {
    return "Login failed. Check username/password, confirm the account is active, and if you retried too many times wait 15 minutes or clear the matching auth_throttles record.";
  }

  return error;
}

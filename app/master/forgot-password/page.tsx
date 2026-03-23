import { PasswordResetNotice } from "@/components/PasswordResetNotice";

export default function MasterForgotPasswordPage() {
  return (
    <PasswordResetNotice
      title="Master Password Help"
      subtitle="Secure password changes require an authenticated session."
      loginHref="/master/login"
    />
  );
}

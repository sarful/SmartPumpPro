import { PasswordResetNotice } from "@/components/PasswordResetNotice";

export default function AdminForgotPasswordPage() {
  return (
    <PasswordResetNotice
      title="Admin Password Help"
      subtitle="Secure password changes require an authenticated session."
      loginHref="/admin/login"
    />
  );
}

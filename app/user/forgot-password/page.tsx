import { PasswordResetNotice } from "@/components/PasswordResetNotice";

export default function UserForgotPasswordPage() {
  return (
    <PasswordResetNotice
      title="User Password Help"
      subtitle="Secure password changes require an authenticated session."
      loginHref="/user/login"
    />
  );
}

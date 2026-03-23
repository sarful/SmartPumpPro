import { PasswordChangePage } from "@/components/PasswordChangePage";

export default function UserChangePasswordPage() {
  return (
    <PasswordChangePage
      expectedRole="user"
      loginHref="/user/login"
      dashboardHref="/user/dashboard"
      title="Change User Password"
      subtitle="Update your password with your current credentials."
    />
  );
}

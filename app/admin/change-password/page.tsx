import { PasswordChangePage } from "@/components/PasswordChangePage";

export default function AdminChangePasswordPage() {
  return (
    <PasswordChangePage
      expectedRole="admin"
      loginHref="/admin/login"
      dashboardHref="/admin/dashboard"
      title="Change Admin Password"
      subtitle="Update your password with your current credentials."
    />
  );
}

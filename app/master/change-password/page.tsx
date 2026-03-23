import { PasswordChangePage } from "@/components/PasswordChangePage";

export default function MasterChangePasswordPage() {
  return (
    <PasswordChangePage
      expectedRole="master"
      loginHref="/master/login"
      dashboardHref="/master/dashboard"
      title="Change Master Password"
      subtitle="Update your password with your current credentials."
    />
  );
}

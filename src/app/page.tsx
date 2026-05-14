import { AccountSwitcher } from "@/components/account-switcher";
import { TriagedInboxView } from "@/components/triaged-inbox-view";

export default function HomePage() {
  return (
    <main className="space-y-8">
      <div className="flex items-center justify-between">
        <AccountSwitcher />
      </div>
      <TriagedInboxView loading />
    </main>
  );
}

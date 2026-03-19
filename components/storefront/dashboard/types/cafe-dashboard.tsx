import { Suspense } from "react";

import {
  DashboardWorkspaceSkeleton,
  ThemedStorefrontDashboard,
  type StorefrontDashboardProps,
} from "@/components/storefront/dashboard/shared";

export function CafeStorefrontDashboard(props: StorefrontDashboardProps) {
  return (
    <Suspense fallback={<DashboardWorkspaceSkeleton themeName="cafe" />}>
      <ThemedStorefrontDashboard {...props} themeName="cafe" />
    </Suspense>
  );
}

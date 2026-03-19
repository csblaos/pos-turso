import { Suspense } from "react";

import {
  DashboardWorkspaceSkeleton,
  ThemedStorefrontDashboard,
  type StorefrontDashboardProps,
} from "@/components/storefront/dashboard/shared";

export function OnlineStorefrontDashboard(props: StorefrontDashboardProps) {
  return (
    <Suspense fallback={<DashboardWorkspaceSkeleton themeName="online" />}>
      <ThemedStorefrontDashboard {...props} themeName="online" />
    </Suspense>
  );
}

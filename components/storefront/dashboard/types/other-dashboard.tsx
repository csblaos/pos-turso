import { Suspense } from "react";

import {
  DashboardWorkspaceSkeleton,
  ThemedStorefrontDashboard,
  type StorefrontDashboardProps,
} from "@/components/storefront/dashboard/shared";

export function OtherStorefrontDashboard(props: StorefrontDashboardProps) {
  return (
    <Suspense fallback={<DashboardWorkspaceSkeleton themeName="other" />}>
      <ThemedStorefrontDashboard {...props} themeName="other" />
    </Suspense>
  );
}

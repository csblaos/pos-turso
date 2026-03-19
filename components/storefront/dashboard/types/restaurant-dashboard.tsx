import { Suspense } from "react";

import {
  DashboardWorkspaceSkeleton,
  ThemedStorefrontDashboard,
  type StorefrontDashboardProps,
} from "@/components/storefront/dashboard/shared";

export function RestaurantStorefrontDashboard(props: StorefrontDashboardProps) {
  return (
    <Suspense fallback={<DashboardWorkspaceSkeleton themeName="restaurant" />}>
      <ThemedStorefrontDashboard {...props} themeName="restaurant" />
    </Suspense>
  );
}

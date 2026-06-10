import { lazy, Suspense } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { OnboardingGate } from "./components/OnboardingGate";
import { PinGate } from "./components/PinGate";
import { HomePage } from "./pages/HomePage";

const SubscriptionsListPage = lazy(() =>
  import("./pages/SubscriptionsListPage").then((m) => ({ default: m.SubscriptionsListPage })),
);
const OnlineAccountsPage = lazy(() =>
  import("./pages/OnlineAccountsPage").then((m) => ({ default: m.OnlineAccountsPage })),
);
const CancelledSubscriptionsPage = lazy(() =>
  import("./pages/CancelledSubscriptionsPage").then((m) => ({
    default: m.CancelledSubscriptionsPage,
  })),
);
const InsightsPage = lazy(() =>
  import("./pages/InsightsPage").then((m) => ({ default: m.InsightsPage })),
);
const NewSubscriptionPage = lazy(() =>
  import("./pages/NewSubscriptionPage").then((m) => ({ default: m.NewSubscriptionPage })),
);
const DetailPage = lazy(() => import("./pages/DetailPage").then((m) => ({ default: m.DetailPage })));
const EditSubscriptionPage = lazy(() =>
  import("./pages/EditSubscriptionPage").then((m) => ({ default: m.EditSubscriptionPage })),
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);

function PageFallback() {
  return (
    <p className="sk-text-hint py-8 text-center text-sm" aria-busy="true">
      …
    </p>
  );
}

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

export default function App() {
  return (
    <HashRouter>
      <OnboardingGate>
        <PinGate>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route
                path="list"
                element={
                  <LazyPage>
                    <SubscriptionsListPage />
                  </LazyPage>
                }
              />
              <Route
                path="accounts"
                element={
                  <LazyPage>
                    <OnlineAccountsPage />
                  </LazyPage>
                }
              />
              <Route
                path="cancelled"
                element={
                  <LazyPage>
                    <CancelledSubscriptionsPage />
                  </LazyPage>
                }
              />
              <Route
                path="insights"
                element={
                  <LazyPage>
                    <InsightsPage />
                  </LazyPage>
                }
              />
              <Route
                path="new"
                element={
                  <LazyPage>
                    <NewSubscriptionPage />
                  </LazyPage>
                }
              />
              <Route
                path="sub/:id"
                element={
                  <LazyPage>
                    <DetailPage />
                  </LazyPage>
                }
              />
              <Route
                path="sub/:id/edit"
                element={
                  <LazyPage>
                    <EditSubscriptionPage />
                  </LazyPage>
                }
              />
              <Route
                path="settings"
                element={
                  <LazyPage>
                    <SettingsPage />
                  </LazyPage>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </PinGate>
      </OnboardingGate>
    </HashRouter>
  );
}

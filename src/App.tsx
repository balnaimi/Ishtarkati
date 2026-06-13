import { lazy, Suspense } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import i18n from "./i18n";
import { Layout } from "./components/Layout";
import { LocaleBootstrap } from "./components/LocaleBootstrap";
import { OnboardingGate } from "./components/OnboardingGate";
import { PinGate } from "./components/PinGate";
import { HomePage } from "./pages/HomePage";

const SubscriptionsListPage = lazy(() =>
  import("./pages/SubscriptionsListPage").then((m) => ({ default: m.SubscriptionsListPage })),
);
const PaymentMethodsPage = lazy(() =>
  import("./pages/PaymentMethodsPage").then((m) => ({ default: m.PaymentMethodsPage })),
);

function CancelledRedirect() {
  return <Navigate to="/accounts?tab=deleted" replace />;
}
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
      {i18n.t("common.loading")}
    </p>
  );
}

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

export default function App() {
  return (
    <HashRouter>
      <LocaleBootstrap>
        <OnboardingGate>
        <PinGate>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="list" element={<Navigate to="/accounts" replace />} />
              <Route
                path="accounts"
                element={
                  <LazyPage>
                    <SubscriptionsListPage />
                  </LazyPage>
                }
              />
              <Route path="cancelled" element={<CancelledRedirect />} />
              <Route
                path="payments"
                element={
                  <LazyPage>
                    <PaymentMethodsPage />
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
      </LocaleBootstrap>
    </HashRouter>
  );
}

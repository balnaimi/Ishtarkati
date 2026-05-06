import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { OnboardingGate } from "./components/OnboardingGate";
import { PinGate } from "./components/PinGate";
import { HomePage } from "./pages/HomePage";
import { SubscriptionsListPage } from "./pages/SubscriptionsListPage";
import { NewSubscriptionPage } from "./pages/NewSubscriptionPage";
import { EditSubscriptionPage } from "./pages/EditSubscriptionPage";
import { DetailPage } from "./pages/DetailPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  return (
    <HashRouter>
      <OnboardingGate>
        <PinGate>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="list" element={<SubscriptionsListPage />} />
              <Route path="new" element={<NewSubscriptionPage />} />
              <Route path="sub/:id" element={<DetailPage />} />
              <Route path="sub/:id/edit" element={<EditSubscriptionPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </PinGate>
      </OnboardingGate>
    </HashRouter>
  );
}

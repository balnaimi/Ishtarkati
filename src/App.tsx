import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { NewSubscriptionPage } from "./pages/NewSubscriptionPage";
import { EditSubscriptionPage } from "./pages/EditSubscriptionPage";
import { DetailPage } from "./pages/DetailPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { StatsPage } from "./pages/StatsPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="new" element={<NewSubscriptionPage />} />
          <Route path="sub/:id" element={<DetailPage />} />
          <Route path="sub/:id/edit" element={<EditSubscriptionPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

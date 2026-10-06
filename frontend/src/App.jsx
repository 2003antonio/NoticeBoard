import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./context/AuthContext";
import { homePath } from "./lib/roles";
import AppShell from "./components/AppShell";
import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import NotFound from "./pages/NotFound";
import Notifications from "./pages/Notifications";

import MyPlans from "./pages/trainee/MyPlans";
import TraineePlanDetail from "./pages/trainee/PlanDetail";

import OnboardTrainee from "./pages/hr/OnboardTrainee";
import Trainees from "./pages/hr/Trainees";

import Plans from "./pages/manager/Plans";
import ManagerPlanDetail from "./pages/manager/PlanDetail";
import Cohorts from "./pages/manager/Cohorts";
import CohortDetail from "./pages/manager/CohortDetail";
import Dashboard from "./pages/manager/Dashboard";

// Sends a logged-in user from "/" to the right home for their role.
function Home() {
  const { user } = useAuth();
  return <Navigate to={homePath(user.role)} replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Standalone pages (no app shell). */}
      <Route path="/login" element={<Login />} />
      <Route
        path="/change-password"
        element={
          <ProtectedRoute allowPasswordChange>
            <ChangePassword />
          </ProtectedRoute>
        }
      />

      {/* Everything inside the shell requires login and a changed password. */}
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Home />} />

        {/* Any signed-in user */}
        <Route path="/notifications" element={<Notifications />} />

        {/* Trainee */}
        <Route
          path="/my/plans"
          element={<ProtectedRoute roles={["trainee"]}><MyPlans /></ProtectedRoute>}
        />
        <Route
          path="/my/plans/:planId"
          element={<ProtectedRoute roles={["trainee"]}><TraineePlanDetail /></ProtectedRoute>}
        />

        {/* HR */}
        <Route path="/trainees" element={<ProtectedRoute roles={["hr", "manager"]}><Trainees /></ProtectedRoute>} />
        <Route path="/onboard" element={<ProtectedRoute roles={["hr"]}><OnboardTrainee /></ProtectedRoute>} />

        {/* Manager */}
        <Route path="/dashboard" element={<ProtectedRoute roles={["manager"]}><Dashboard /></ProtectedRoute>} />
        <Route path="/plans" element={<ProtectedRoute roles={["manager"]}><Plans /></ProtectedRoute>} />
        <Route path="/plans/:planId" element={<ProtectedRoute roles={["manager"]}><ManagerPlanDetail /></ProtectedRoute>} />
        <Route path="/cohorts" element={<ProtectedRoute roles={["manager"]}><Cohorts /></ProtectedRoute>} />
        <Route path="/cohorts/:cohortId" element={<ProtectedRoute roles={["manager"]}><CohortDetail /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

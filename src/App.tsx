import { lazy } from 'react';
import './i18n';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { SuspenseWithTimeout } from "@/components/SuspenseWithTimeout";
import Index from "./pages/Index";

const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const SharedDiagram = lazy(() => import('./pages/SharedDiagram'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Landing = lazy(() => import('./pages/Landing'));
const Billing = lazy(() => import('./pages/Billing'));
const Workspace = lazy(() => import('./pages/Workspace'));
const WorkspaceDiagrams = lazy(() => import('./pages/WorkspaceDiagrams'));
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'));
const AdminApp = lazy(() => import('./pages/admin/AdminApp'));
const AdminGuard = lazy(() => import('./pages/admin/AdminGuard'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 300_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <SuspenseWithTimeout>
              <Routes>
                <Route path="/" element={
                  <RouteErrorBoundary routeName="landing">
                    <Landing />
                  </RouteErrorBoundary>
                } />
                <Route path="/app" element={
                  <RouteErrorBoundary routeName="canvas">
                    <Index />
                  </RouteErrorBoundary>
                } />
                <Route path="/reset-password" element={
                  <RouteErrorBoundary routeName="reset-password">
                    <ResetPassword />
                  </RouteErrorBoundary>
                } />
                <Route path="/diagram/:shareToken" element={
                  <RouteErrorBoundary routeName="shared-diagram">
                    <SharedDiagram />
                  </RouteErrorBoundary>
                } />
                <Route path="/billing" element={
                  <ProtectedRoute>
                    <RouteErrorBoundary routeName="billing">
                      <Billing />
                    </RouteErrorBoundary>
                  </ProtectedRoute>
                } />
                <Route path="/workspace" element={
                  <ProtectedRoute>
                    <RouteErrorBoundary routeName="workspace">
                      <Workspace />
                    </RouteErrorBoundary>
                  </ProtectedRoute>
                } />
                <Route path="/workspace/diagrams" element={
                  <ProtectedRoute>
                    <RouteErrorBoundary routeName="workspace-diagrams">
                      <WorkspaceDiagrams />
                    </RouteErrorBoundary>
                  </ProtectedRoute>
                } />
                <Route path="/invite" element={
                  <RouteErrorBoundary routeName="accept-invite">
                    <AcceptInvite />
                  </RouteErrorBoundary>
                } />
                <Route path="/terms" element={
                  <RouteErrorBoundary routeName="terms">
                    <Terms />
                  </RouteErrorBoundary>
                } />
                <Route path="/privacy" element={
                  <RouteErrorBoundary routeName="privacy">
                    <Privacy />
                  </RouteErrorBoundary>
                } />
                <Route path="/admin/*" element={
                  <AdminGuard>
                    <RouteErrorBoundary routeName="admin">
                      <AdminApp />
                    </RouteErrorBoundary>
                  </AdminGuard>
                } />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </SuspenseWithTimeout>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;

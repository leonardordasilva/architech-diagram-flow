import { lazy, Suspense } from 'react';
import './i18n';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoadingSpinner from "@/components/LoadingSpinner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";

const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const SharedDiagram = lazy(() => import('./pages/SharedDiagram'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Landing = lazy(() => import('./pages/Landing'));
const Billing = lazy(() => import('./pages/Billing'));
const Workspace = lazy(() => import('./pages/Workspace'));
const WorkspaceDiagrams = lazy(() => import('./pages/WorkspaceDiagrams'));
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'));

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
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/app" element={<Index />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/diagram/:shareToken" element={<SharedDiagram />} />
                <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
                <Route path="/workspace" element={<ProtectedRoute><Workspace /></ProtectedRoute>} />
                <Route path="/workspace/diagrams" element={<ProtectedRoute><WorkspaceDiagrams /></ProtectedRoute>} />
                <Route path="/invite" element={<AcceptInvite />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;


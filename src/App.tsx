import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PvPScreen } from "./pages/PvPScreen";
import { ReffScreen } from "./pages/ReffScreen";
import { GameScreen } from "./pages/GameScreen";
import { MarketScreen } from "./pages/MarketScreen";
import { HistoryScreen } from "./pages/HistoryScreen";
import NotFound from "./pages/NotFound";
import { Layout } from "./components/layout/Layout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<PvPScreen />} />
            <Route path="market" element={<MarketScreen />} />
            <Route path="earn" element={<ReffScreen />} />
            <Route path="history" element={<HistoryScreen />} />
          </Route>
          <Route path="/game" element={<GameScreen />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

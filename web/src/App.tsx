import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { Shell } from './components/Shell';
import { ToastProvider } from './components/ui';
import { AuthPage } from './pages/AuthPage';
import { BacktestsPage } from './pages/BacktestsPage';
import { BotsPage } from './pages/BotsPage';
import { JournalPage } from './pages/JournalPage';
import { LibraryPage } from './pages/LibraryPage';
import { MarketsPage } from './pages/MarketsPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { AIPage } from './pages/AIPage';
import { SettingsPage } from './pages/SettingsPage';
import { Terminal } from './terminal/Terminal';

function Gate({ children }: { children: React.ReactNode }) {
    const { user, ready } = useAuth();
    const loc = useLocation();
    if (!ready) return <div className="center"><span className="spinner dark" /></div>;
    if (!user) return <Navigate to="/auth" replace state={{ from: loc.pathname }} />;
    return <Shell>{children}</Shell>;
}

export default function App() {
    return (
        <ToastProvider>
            <AuthProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/auth" element={<AuthPage />} />
                        <Route path="/" element={<Gate><Terminal /></Gate>} />
                        <Route path="/chart/:symbol" element={<Gate><Terminal /></Gate>} />
                        <Route path="/markets" element={<Gate><MarketsPage /></Gate>} />
                        <Route path="/bots" element={<Gate><BotsPage /></Gate>} />
                        <Route path="/backtests" element={<Gate><BacktestsPage /></Gate>} />
                        <Route path="/journal" element={<Gate><JournalPage /></Gate>} />
                        <Route path="/portfolio" element={<Gate><PortfolioPage /></Gate>} />
                        <Route path="/library" element={<Gate><LibraryPage /></Gate>} />
                        <Route path="/ai" element={<Gate><AIPage /></Gate>} />
                        <Route path="/settings" element={<Gate><SettingsPage /></Gate>} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </BrowserRouter>
            </AuthProvider>
        </ToastProvider>
    );
}

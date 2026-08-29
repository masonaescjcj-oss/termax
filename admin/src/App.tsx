import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import UserDetail from './pages/UserDetail';
import Positions from './pages/Positions';
import Brokers from './pages/Brokers';
import Communities from './pages/Communities';
import Symbols from './pages/Symbols';
import Reviews from './pages/Reviews';
import Campaigns from './pages/Campaigns';
import Lotties from './pages/Lotties';
import AIConfig from './pages/AIConfig';
import Audit from './pages/Audit';

export default function App() {
    const { user, ready } = useAuth();

    // Until the stored session has been checked against the server, showing
    // either the login form or the console would be a guess — and a wrong
    // guess flashes the wrong screen.
    if (!ready) return <div className="empty" style={{ paddingTop: 120 }}>Checking your session…</div>;

    if (!user) return <Login />;

    return (
        <Layout>
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/users" element={<Users />} />
                <Route path="/users/:id" element={<UserDetail />} />
                <Route path="/positions" element={<Positions />} />
                <Route path="/brokers" element={<Brokers />} />
                <Route path="/communities" element={<Communities />} />
                <Route path="/symbols" element={<Symbols />} />
                <Route path="/reviews" element={<Reviews />} />
                <Route path="/campaigns" element={<Campaigns />} />
                <Route path="/lotties" element={<Lotties />} />
                <Route path="/ai" element={<AIConfig />} />
                <Route path="/audit" element={<Audit />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Layout>
    );
}

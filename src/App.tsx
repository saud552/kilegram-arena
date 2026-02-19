import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SquadProvider, useSquad } from './context/SquadContext';
import { getStartParam } from './lib/telegram';
import SplashScreen from './components/SplashScreen';
import CharacterSelect from './components/CharacterSelect';
import HomeScreen from './components/HomeScreen';
import LobbyScreen from './components/LobbyScreen';
import GameArena from './components/GameArena';
import Store from './pages/Store';
import Squad from './pages/Squad';
import Profile from './pages/Profile';
import Wiki from './components/wiki';
import AdminDashboard from './pages/AdminDashboard';
import BottomNav from './components/BottomNav';

function AppRoutes() {
  const { user, isLoading } = useAuth();
  const { joinSquad } = useSquad();
  const navigate = useNavigate();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    const startParam = getStartParam();
    if (startParam) {
      joinSquad(startParam).then(success => {
        navigate(success ? '/lobby' : '/');
        setInitialized(true);
      });
    } else {
      setInitialized(true);
    }
  }, [isLoading, joinSquad, navigate]);

  if (isLoading || !initialized) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-cyan-400 animate-pulse">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/lobby" element={<LobbyScreen />} />
      <Route path="/arena" element={<GameArena />} />
      <Route path="/store" element={<Store />} />
      <Route path="/squad" element={<Squad />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/wiki" element={<Wiki />} />
      <Route path="/admin" element={<AdminDashboard />} />
    </Routes>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [showCharacterSelect, setShowCharacterSelect] = useState(false);

  useEffect(() => {
    if (!showSplash && !isLoading) {
      const hasSeenCharacterSelect = localStorage.getItem('kilegram_has_seen_character_select');
      if (!hasSeenCharacterSelect && user) {
        setShowCharacterSelect(true);
        localStorage.setItem('kilegram_has_seen_character_select', 'true');
      }
    }
  }, [showSplash, isLoading, user]);

  if (showSplash) return <SplashScreen onFinish={() => setShowSplash(false)} />;
  if (showCharacterSelect) return <CharacterSelect />;

  return (
    <>
      <AppRoutes />
      <BottomNav />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <SquadProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </SquadProvider>
    </AuthProvider>
  );
}

export default App;

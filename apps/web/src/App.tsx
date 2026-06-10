import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import LoginPage from '@/pages/LoginPage';
import PaperListPage from '@/pages/PaperListPage';
import ReadingRoomPage from '@/pages/ReadingRoomPage';
import ArchivePage from '@/pages/ArchivePage';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

function HydrateWrapper({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <HydrateWrapper>
        <Layout>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<PaperListPage />} />
            <Route path="/papers/:id" element={<ReadingRoomPage />} />
            <Route path="/papers/:id/archive" element={<ArchivePage />} />
          </Routes>
        </Layout>
      </HydrateWrapper>
    </BrowserRouter>
  );
}

export default App;

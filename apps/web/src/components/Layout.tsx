import { useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, LogOut, User } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, isHydrated, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isHydrated) return;
    if (!user && location.pathname !== '/login') {
      navigate('/login');
    }
  }, [user, isHydrated, location.pathname, navigate]);

  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const isLoginPage = location.pathname === '/login';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {!isLoginPage && (
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-blue-600" />
              <span className="font-bold text-lg text-gray-900">PaperLens</span>
            </Link>
            {user && (
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {user.displayName || user.email}
                </span>
                <button
                  onClick={() => {
                    logout();
                    navigate('/login');
                  }}
                  className="text-sm text-gray-500 hover:text-red-600 flex items-center gap-1 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  退出
                </button>
              </div>
            )}
          </div>
        </header>
      )}
      <main className="flex-1">{children}</main>
    </div>
  );
}

import { NavLink } from 'react-router-dom';
import { useStore } from '../../stores/useStore';
import { useAuth } from '../../contexts/AuthContext';

export function Navigation() {
  const { currentProfile } = useStore();
  const { user, signOut } = useAuth();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-2 rounded-lg transition-colors ${
      isActive
        ? 'bg-blue-600 text-white'
        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
    }`;

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-blue-600">CoverLetter</span>
          <span className="text-gray-500">Generator</span>
        </div>

        {user && (
          <div className="flex items-center gap-2">
            <NavLink to="/profile" className={linkClass}>
              My Profile
            </NavLink>
            <NavLink to="/" className={linkClass}>
              New Letter
            </NavLink>
            <NavLink to="/history" className={linkClass}>
              My Letters
            </NavLink>
            <NavLink to="/cv-tailor" className={linkClass}>
              CV Tailor
            </NavLink>
            <NavLink to="/interview-prep" className={linkClass}>
              Interview Prep
            </NavLink>
            <NavLink to="/settings" className={linkClass}>
              Settings
            </NavLink>
          </div>
        )}

        <div className="flex items-center gap-3">
          {currentProfile && (
            <span className="text-sm text-gray-500">
              {currentProfile.name}
            </span>
          )}
          {user && (
            <button
              onClick={() => signOut()}
              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-3 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Sign Out
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

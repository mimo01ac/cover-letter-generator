import { useAuth } from '../../contexts/AuthContext';

export function SettingsPage() {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    if (confirm('Are you sure you want to sign out?')) {
      await signOut();
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
        Settings
      </h1>

      {/* Account Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
          Account
        </h2>

        <div className="space-y-2">
          <div className="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400">Email</span>
            <span className="text-gray-800 dark:text-white font-medium">
              {user?.email}
            </span>
          </div>
          <div className="flex justify-between items-center py-3">
            <span className="text-gray-600 dark:text-gray-400">Session</span>
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
          Preferences
        </h2>

        <div className="space-y-4">
          <div className="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-700">
            <div>
              <p className="text-gray-800 dark:text-white font-medium">Default Language</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Language for generated cover letters</p>
            </div>
            <select
              disabled
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
            >
              <option>English</option>
            </select>
          </div>

          <div className="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-700">
            <div>
              <p className="text-gray-800 dark:text-white font-medium">Default Tone</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Writing style for cover letters</p>
            </div>
            <select
              disabled
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
            >
              <option>Professional</option>
            </select>
          </div>

          <div className="flex justify-between items-center py-3">
            <div>
              <p className="text-gray-800 dark:text-white font-medium">Dark Mode</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Follows system preference</p>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Auto</span>
          </div>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500 pt-2">
          More preferences coming soon
        </p>
      </div>

      {/* Data Management */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
          Data Storage
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Your data is securely stored in the cloud and synced across all your devices.
        </p>

        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Your profiles, documents, and cover letters are automatically saved and backed up.
          </p>
        </div>
      </div>
    </div>
  );
}

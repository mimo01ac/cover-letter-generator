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
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Settings
      </h1>

      {/* Account Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Account
        </h2>

        <div className="space-y-2">
          <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400">Email</span>
            <span className="text-gray-900 dark:text-white font-medium">
              {user?.email}
            </span>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors font-medium"
        >
          Sign Out
        </button>
      </div>

      {/* Data Management */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
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

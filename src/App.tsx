import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AppLayout } from './components/Layout';
import { Generator } from './components/CoverLetter';
import { HistoryPage } from './components/CoverLetter';
import { ProfilePage } from './components/Profile';
import { SettingsPage } from './components/Settings';
import { ResetPasswordPage } from './components/Auth/ResetPasswordPage';
import { InterviewPrepPage } from './components/InterviewPrep';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<Generator />} />
            <Route path="/interview-prep" element={<InterviewPrepPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

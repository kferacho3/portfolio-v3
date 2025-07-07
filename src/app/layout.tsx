// ==========================  app/layout.tsx (patched) ==========================
import type { Metadata } from 'next';
import CanvasProvider from '../components/CanvasProvider';
import Navbar from '../components/Navbar';
import { GameProvider } from '../contexts/GameContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'My Portfolio',
  description: 'Welcome to my Portfolio',
  icons: { icon: '/favicon.ico' }, // <– this already injects the favicon
};

const RootLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <html lang="en" className="dark" suppressHydrationWarning>
    <body className="min-h-screen bg-dark-cloud">
      <ThemeProvider>
        <Navbar />
        <GameProvider>
          <CanvasProvider>{children}</CanvasProvider>
        </GameProvider>
      </ThemeProvider>
    </body>
  </html>
);

export default RootLayout;

// src/app/layout.tsx

import type { Metadata } from 'next';
import CanvasProvider from '../components/CanvasProvider';
import Navbar from '../components/Navbar';
import { GameProvider } from '../contexts/GameContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'My Portfolio',
  description: 'Welcome to my Portfolio',
  icons: {
    icon: '/favicon.ico', // Ensure this path matches your favicon's location in the public directory
  },
};

const RootLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="min-h-screen bg-cloud-aqua dark:bg-dark-cloud">
        <ThemeProvider>
          <Navbar />
          <GameProvider>
            <CanvasProvider>{children}</CanvasProvider>
          </GameProvider>
        </ThemeProvider>
      </body>
    </html>
  );
};

export default RootLayout;

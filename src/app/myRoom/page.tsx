// src/app/myRoom/page.tsx
'use client';

import CanvasProvider from '../../components/CanvasProvider';
import MyRoom from './components/MyRoom';

export default function MyRoomPage() {
  return (
    <CanvasProvider>
      <MyRoom />
    </CanvasProvider>
  );
}

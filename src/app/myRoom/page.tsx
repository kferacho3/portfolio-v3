// src/app/myRoom/page.tsx
'use client';

import { Canvas } from '@react-three/fiber';
import { AnimatePresence, motion } from 'framer-motion';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import MusicControl from './components/MusicControls';
import MyRoomScene from './components/MyRoom';
import { GroupData, groupData } from './components/groupData';
import {
  closetGroups,
  goldGroups,
  meBitsGroups,
  redGroups,
  whiteGroups,
} from './components/groupConstants';

// Loading component - Simplified for performance
const LoadingScreen = () => (
  <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950">
    <motion.div
      className="flex flex-col items-center gap-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="w-12 h-12 border-2 border-[#39FF14] border-t-transparent rounded-full animate-spin" />
      <span className="text-sm text-white/60 tracking-wider">Loading Room...</span>
    </motion.div>
  </div>
);

// Detect if device is low-end (mobile or low memory)
const isLowEndDevice = () => {
  if (typeof window === 'undefined') return false;
  const memory = (navigator as any).deviceMemory;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  return isMobile || (memory && memory < 4);
};

export default function MyRoomPage() {
  // Audio state - managed at page level for 2D overlay access
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [analyser, setAnalyser] = useState<THREE.AudioAnalyser | null>(null);
  const audioRef = useRef<THREE.Audio | null>(null);
  const listenerRef = useRef<THREE.AudioListener | null>(null);

  // Group state for UI overlay
  const [groups, setGroups] = useState<GroupData[]>(groupData);
  const [inspectedModel, setInspectedModel] = useState<string | null>(null);
  const [foundMeBitsCount, setFoundMeBitsCount] = useState(0);
  const [foundMessage, setFoundMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Performance tier detection
  const performanceTier = useMemo(() => isLowEndDevice() ? 'low' : 'high', []);

  // Initialize audio - with smaller FFT for memory savings
  useEffect(() => {
    const listener = new THREE.AudioListener();
    listenerRef.current = listener;
    
    const audio = new THREE.Audio(listener);
    audioRef.current = audio;

    const audioLoader = new THREE.AudioLoader();
    audioLoader.load(
      'https://racho-devs.s3.us-east-2.amazonaws.com/about/music/Insane!_8.mp3',
      (buffer) => {
        audio.setBuffer(buffer);
        audio.setLoop(true);
        audio.setVolume(0.75);
        setIsAudioReady(true);
      }
    );

    // Minimal FFT size (32 bins) - saves significant memory vs 64 or higher
    const newAnalyser = new THREE.AudioAnalyser(audio, 32);
    setAnalyser(newAnalyser);

    return () => {
      audio.stop();
      audio.disconnect();
      // Clean up audio buffer
      if (audio.buffer) {
        audio.setBuffer(null as any);
      }
    };
  }, []);

  const togglePlay = useCallback(() => {
    if (!isAudioReady || !audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else if (!audioRef.current.isPlaying) {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isAudioReady, isPlaying]);

  // Handlers
  const handleInspect = useCallback((modelName: string | null) => {
    setInspectedModel((prev) => (prev === modelName ? null : modelName));
  }, []);

  const handleCloseInspect = useCallback(() => {
    setInspectedModel(null);
  }, []);

  const resetSelections = useCallback(() => {
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        isSelected: false,
        isFound: group.isFound || false,
      }))
    );
    setInspectedModel(null);
  }, []);

  const handleMeBitFound = useCallback((name: string) => {
    setFoundMeBitsCount((prev) => prev + 1);
    setGroups((prev) =>
      prev.map((group) =>
        group.name === name
          ? { ...group, isFound: true, isSelected: true }
          : group
      )
    );

    const adjectives = ['Nice find.', 'Clean pickup.', 'Great eye.', 'On the board.', 'Found.'];
    const closeAdjectives = ['Almost there.', 'Close to the full set.', 'Just a few more.', 'Keep going.'];
    
    const nextCount = foundMeBitsCount + 1;
    const adjective = nextCount >= Math.max(3, meBitsGroups.length - 3)
      ? closeAdjectives[Math.floor(Math.random() * closeAdjectives.length)]
      : adjectives[Math.floor(Math.random() * adjectives.length)];

    setFoundMessage(`${adjective} You found "${name}". ${nextCount}/${meBitsGroups.length} MeBits.`);
    setTimeout(() => setFoundMessage(null), 3000);
  }, [foundMeBitsCount]);

  // Helper functions
  const isGroupSelected = (group: GroupData) => {
    return meBitsGroups.includes(group.name)
      ? group.isSelected && group.isFound
      : group.isSelected;
  };

  const firstSelectedGroup = groups.find(isGroupSelected);

  const getOutlineColor = (name: string): string => {
    if (goldGroups.includes(name)) return '#FFFFFF';
    if (redGroups.includes(name)) return '#FF6B6B';
    if (whiteGroups.includes(name)) return '#E8E8E8';
    if (closetGroups.includes(name)) return '#4DE1FF';
    if (meBitsGroups.includes(name)) return '#10B981';
    return '#FFFFFF';
  };

  const getCategoryInfo = (name: string): { label: string; icon: string } => {
    if (goldGroups.includes(name)) return { label: 'Feature', icon: '✦' };
    if (redGroups.includes(name)) return { label: 'Display', icon: '◈' };
    if (whiteGroups.includes(name)) return { label: 'Setup', icon: '◎' };
    if (closetGroups.includes(name)) return { label: 'Gear', icon: '◇' };
    if (meBitsGroups.includes(name)) return { label: 'Collectible', icon: '★' };
    return { label: 'Item', icon: '○' };
  };

  // Prevent body scroll when overlay active
  useEffect(() => {
    const isOverlayActive = firstSelectedGroup || inspectedModel || foundMessage;
    document.body.style.overflow = isOverlayActive ? 'hidden' : 'auto';
    return () => { document.body.style.overflow = 'auto'; };
  }, [firstSelectedGroup, inspectedModel, foundMessage]);

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ backgroundColor: 'transparent' }}>
      {/* Loading Screen */}
      <AnimatePresence>
        {isLoading && <LoadingScreen />}
      </AnimatePresence>

      {/* 3D Canvas - Heavily Optimized for Memory & Performance */}
      <Canvas
        shadows={performanceTier === 'high'}
        dpr={performanceTier === 'low' ? 1 : [1, 1.25]}
        gl={{
          antialias: performanceTier === 'high',
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
          alpha: false,
          preserveDrawingBuffer: false,
          failIfMajorPerformanceCaveat: false,
        }}
        camera={{ position: [-5, 2, 6], fov: 50, near: 0.5, far: 100 }}
        onCreated={({ gl, camera, scene }) => {
          // Optimized color space
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.1;
          
          // Shadow configuration
          gl.shadowMap.enabled = performanceTier === 'high';
          gl.shadowMap.type = THREE.BasicShadowMap;
          
          // Aggressive DPR cap
          const maxDpr = performanceTier === 'low' ? 1 : Math.min(window.devicePixelRatio, 1.25);
          gl.setPixelRatio(maxDpr);
          
          // Memory optimizations
          gl.info.autoReset = false;
          
          // Set background color to avoid transparency overhead
          scene.background = new THREE.Color(0x0a0f1a);
          
          // Attach audio listener to camera
          if (listenerRef.current) {
            camera.add(listenerRef.current);
          }
          
          // Signal loading complete
          setTimeout(() => setIsLoading(false), 800);
        }}
        className="w-full h-full"
      >
        <Suspense fallback={null}>
          <MyRoomScene
            analyser={analyser}
            isPlaying={isPlaying}
            groups={groups}
            setGroups={setGroups}
            inspectedModel={inspectedModel}
            onInspect={handleInspect}
            onCloseInspect={handleCloseInspect}
            onMeBitFound={handleMeBitFound}
          />
        </Suspense>
      </Canvas>

      {/* 2D UI Overlay - Outside Canvas for better performance */}
      {/* Note: top-16 sm:top-20 accounts for navbar height */}
      <div className="fixed inset-0 pointer-events-none z-10">
        {/* Music Control - Bottom right */}
        <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 pointer-events-auto z-20">
          <MusicControl isPlaying={isPlaying} togglePlay={togglePlay} />
        </div>

        {/* MeBits Counter - Bottom left */}
        <motion.div
          className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 pointer-events-none"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-3 rounded-2xl bg-slate-950/80 backdrop-blur-xl px-4 py-2.5 border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="relative">
              <motion.div
                className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#39FF14]/20 to-[#9400D3]/20 flex items-center justify-center"
                animate={foundMeBitsCount > 0 ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.5 }}
              >
                <span className="text-[10px] font-semibold text-[#39FF14]">MB</span>
              </motion.div>
              {foundMeBitsCount === meBitsGroups.length && (
                <motion.div
                  className="absolute -top-1 -right-1 w-3 h-3 bg-[#39FF14] rounded-full"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                />
              )}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-[#39FF14]">{foundMeBitsCount}</span>
                <span className="text-xs text-white/30">/</span>
                <span className="text-sm text-white/50">{meBitsGroups.length}</span>
              </div>
              <span className="text-[9px] uppercase tracking-[0.15em] text-white/40">MeBits Found</span>
            </div>
            <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden ml-2">
              <motion.div
                className="h-full bg-gradient-to-r from-[#39FF14] to-[#9400D3] rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(foundMeBitsCount / meBitsGroups.length) * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </div>
        </motion.div>

        {/* FFT Status - Top right, below navbar */}
        <AnimatePresence>
          {isPlaying && (
            <motion.div
              className="absolute top-16 right-4 sm:top-20 sm:right-6 pointer-events-none"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.4 }}
            >
              <div className="flex items-center gap-2 rounded-full bg-slate-950/80 backdrop-blur-xl px-3 py-1.5 border border-[#39FF14]/30">
                <motion.div
                  className="w-2 h-2 rounded-full bg-[#39FF14]"
                  animate={{ opacity: [1, 0.5, 1], scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                <span className="text-[10px] uppercase tracking-wider text-[#39FF14]/80">FFT Active</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Selected Group Info Panel */}
        <AnimatePresence>
          {firstSelectedGroup && (
            <motion.div
              className="absolute bottom-4 left-1/2 w-[min(720px,94vw)] -translate-x-1/2 pointer-events-auto sm:bottom-6"
              initial={{ opacity: 0, y: 32, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 32, scale: 0.95 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.div
                className="absolute -inset-4 rounded-[32px] blur-3xl"
                animate={{ opacity: [0.2, 0.35, 0.2] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  background: `radial-gradient(ellipse at center, ${getOutlineColor(firstSelectedGroup.name)}50, transparent 70%)`,
                }}
              />
              <div className="relative rounded-[28px] border border-white/[0.08] bg-gradient-to-b from-slate-900/95 via-slate-900/98 to-slate-950/98 backdrop-blur-2xl overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.5)]">
                <motion.div
                  className="absolute top-0 left-0 right-0 h-[2px]"
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{
                    background: `linear-gradient(90deg, transparent, ${getOutlineColor(firstSelectedGroup.name)}, transparent)`,
                  }}
                />
                <div
                  className="absolute top-0 left-0 w-24 h-24 opacity-20"
                  style={{
                    background: `radial-gradient(circle at top left, ${getOutlineColor(firstSelectedGroup.name)}40, transparent 70%)`,
                  }}
                />
                <div className="p-6 sm:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                    <div className="flex items-center gap-4">
                      <motion.div
                        className="relative w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{
                          background: `linear-gradient(135deg, ${getOutlineColor(firstSelectedGroup.name)}20, ${getOutlineColor(firstSelectedGroup.name)}05)`,
                          border: `1px solid ${getOutlineColor(firstSelectedGroup.name)}30`,
                        }}
                      >
                        <motion.span
                          className="text-2xl"
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        >
                          {getCategoryInfo(firstSelectedGroup.name).icon}
                        </motion.span>
                        <motion.div
                          className="absolute inset-0 rounded-2xl"
                          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                          style={{ border: `2px solid ${getOutlineColor(firstSelectedGroup.name)}` }}
                        />
                      </motion.div>
                      <div>
                        <div
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] uppercase tracking-[0.2em] font-semibold mb-2"
                          style={{
                            background: `${getOutlineColor(firstSelectedGroup.name)}15`,
                            color: getOutlineColor(firstSelectedGroup.name),
                            border: `1px solid ${getOutlineColor(firstSelectedGroup.name)}25`,
                          }}
                        >
                          {getCategoryInfo(firstSelectedGroup.name).label}
                        </div>
                        <h2 className="text-2xl sm:text-[28px] font-bold text-white tracking-tight leading-tight">
                          {firstSelectedGroup.title}
                        </h2>
                      </div>
                    </div>
                    <button
                      className="group flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[10px] uppercase tracking-[0.15em] text-white/60 transition-all hover:bg-white/10 hover:text-white hover:border-white/20 hover:scale-[1.02]"
                      onClick={resetSelections}
                    >
                      <svg className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Close
                    </button>
                  </div>
                  <p className="text-[15px] leading-[1.7] text-slate-300/90 mb-6 max-w-[580px]">
                    {firstSelectedGroup.description}
                  </p>
                  <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-5" />
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <motion.button
                      className="group inline-flex items-center gap-2.5 rounded-2xl px-6 py-3 text-sm font-bold transition-all"
                      style={{
                        background: `linear-gradient(135deg, ${getOutlineColor(firstSelectedGroup.name)}, ${getOutlineColor(firstSelectedGroup.name)}cc)`,
                        boxShadow: `0 8px 32px ${getOutlineColor(firstSelectedGroup.name)}35`,
                        color: closetGroups.includes(firstSelectedGroup.name) || meBitsGroups.includes(firstSelectedGroup.name) || whiteGroups.includes(firstSelectedGroup.name) ? '#0f172a' : '#fff',
                      }}
                      onClick={() => handleInspect(firstSelectedGroup.name)}
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <svg className="h-4.5 w-4.5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                      </svg>
                      Inspect Model
                    </motion.button>
                    <div className="flex items-center gap-3 text-xs text-white/40">
                      <span className="hidden sm:inline">Press</span>
                      <kbd className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 font-mono text-[10px] text-white/60">ESC</kbd>
                      <span className="hidden sm:inline">to close</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MeBit Found Popup */}
        <AnimatePresence>
          {foundMessage && (
            <motion.div
              className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-none sm:top-20"
              initial={{ opacity: 0, y: -30, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="relative flex items-center gap-4 rounded-2xl bg-gradient-to-r from-[#39FF14]/95 via-[#9400D3]/95 to-[#FFA500]/95 px-6 py-4 shadow-[0_12px_48px_rgba(57,255,20,0.45)] backdrop-blur-xl border border-white/20">
                <motion.div
                  className="absolute inset-0 rounded-2xl"
                  animate={{ opacity: [0, 0.3, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)' }}
                />
                <motion.div
                  className="relative w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"
                  animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.15, 1] }}
                  transition={{ duration: 0.6 }}
                >
                  <span className="text-xs font-semibold text-white/80">Found</span>
                </motion.div>
                <div>
                  <span className="block text-sm font-bold text-white">{foundMessage}</span>
                  <span className="text-[10px] text-white/60 uppercase tracking-wider">Keep exploring!</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Instructions hint - positioned in center, above bottom UI */}
        <motion.div
          className="absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-none sm:bottom-24"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ duration: 8, times: [0, 0.1, 0.85, 1], delay: 1 }}
        >
          <div className="flex flex-col items-center gap-2 px-6 py-4 rounded-2xl bg-slate-950/60 backdrop-blur-xl border border-white/[0.06]">
            <p className="text-sm text-white/60 font-medium">Click objects to explore</p>
            <p className="text-[11px] text-white/40">Find all {meBitsGroups.length} hidden MeBits!</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

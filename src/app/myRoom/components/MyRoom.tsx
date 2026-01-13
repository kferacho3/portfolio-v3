// MyRoom.tsx

'use client';

import {
  Html,
  OrbitControls
} from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { AnimatePresence, motion } from 'framer-motion';
import { Suspense, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import FloatingLight from './FloatingLight';
import InspectModel from './InspectModel';
import MusicControl from './MusicControls';
import RachosRoom from './RachosRoomDesktop';
import Track from './Track';
import Zoom from './Zoom';
import { GroupData, groupData } from './groupData';
// Import required classes from three/examples/jsm/postprocessing and shaders
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader';
import {
  closetGroups,
  goldGroups,
  meBitsGroups,
  redGroups,
  whiteGroups,
} from './groupConstants';

const MyRoom = () => {
  const { camera, gl, scene, size } = useThree();
  const [analyser, setAnalyser] = useState<THREE.AudioAnalyser | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const audioRef = useRef<THREE.Audio | null>(null);
  const [isAudioReady, setIsAudioReady] = useState<boolean>(false);

  const url =
    'https://racho-devs.s3.us-east-2.amazonaws.com/about/music/Insane!_8.mp3';

  // Configure renderer for memory optimization
  useEffect(() => {
    gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Cap pixel ratio
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.BasicShadowMap; // Faster shadow type
  }, [gl]);

  useEffect(() => {
    const listener = new THREE.AudioListener();
    camera.add(listener);

    const audio = new THREE.Audio(listener);
    audioRef.current = audio;

    const audioLoader = new THREE.AudioLoader();
    audioLoader.load(url, (buffer) => {
      audio.setBuffer(buffer);
      audio.setLoop(true);
      audio.setVolume(0.75);
      setIsAudioReady(true);
    });

    // Reduced FFT size from 256 to 64 for memory optimization
    const newAnalyser = new THREE.AudioAnalyser(audio, 64);
    setAnalyser(newAnalyser);

    return () => {
      audio.stop();
      audio.disconnect();
      camera.remove(listener);
    };
  }, [url, camera]);

  const togglePlay = () => {
    if (!isAudioReady) return; // Do nothing if audio is not ready

    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      if (audioRef.current && !audioRef.current.isPlaying) {
        audioRef.current.play();
      }
    }
    setIsPlaying(!isPlaying);
  };

  // Manage group data state
  const [groups, setGroups] = useState<GroupData[]>(groupData);

  // State for inspected model
  const [inspectedModel, setInspectedModel] = useState<string | null>(null);

  // State for MeBits found count and messages
  const [foundMeBitsCount, setFoundMeBitsCount] = useState(0);
  const [foundMessage, setFoundMessage] = useState<string | null>(null);

  // Handler to initiate inspection
  const handleInspect = (modelName: string | null) => {
    if (inspectedModel === modelName) {
      // If the same model is selected again, close it
      setInspectedModel(null);
    } else {
      setInspectedModel(modelName);
    }
  };

  // Handler to close inspection
  const handleCloseInspect = () => {
    setInspectedModel(null);
  };

  // Function to reset selections
  const resetSelections = () => {
    setGroups((prevGroups) =>
      prevGroups.map((group) => ({
        ...group,
        isSelected: false,
        isFound: group.isFound || false,
      }))
    );
    setInspectedModel(null);
  };

  // Handler when a MeBit is found
  const handleMeBitFound = (name: string) => {
    setFoundMeBitsCount((prevCount) => prevCount + 1);

    // Update the group to set isFound and isSelected
    setGroups((prevGroups) =>
      prevGroups.map((group) =>
        group.name === name
          ? { ...group, isFound: true, isSelected: true }
          : group
      )
    );

    // Generate a random adjective
    const adjectives = [
      'Nice find.',
      'Clean pickup.',
      'Great eye.',
      'On the board.',
      'Found.',
    ];
    const closeAdjectives = [
      'Almost there.',
      'Close to the full set.',
      'Just a few more.',
      'Keep going.',
    ];
    let adjective =
      adjectives[Math.floor(Math.random() * adjectives.length)];

    const totalMeBits = meBitsGroups.length;
    const nextCount = foundMeBitsCount + 1;

    if (nextCount >= Math.max(3, totalMeBits - 3)) {
      adjective =
        closeAdjectives[Math.floor(Math.random() * closeAdjectives.length)];
    }

    // Set the message
    setFoundMessage(
      `${adjective} You found "${name}". ${nextCount}/${totalMeBits} MeBits.`
    );

    // Remove the message after 3 seconds
    setTimeout(() => {
      setFoundMessage(null);
    }, 3000);
  };

  // Single OutlinePass for memory optimization (was 5 separate passes)
  const composer = useRef<EffectComposer>();
  const outlinePass = useRef<OutlinePass>();
  const [selectedObjects, setSelectedObjects] = useState<THREE.Object3D[]>([]);
  const [currentOutlineColor, setCurrentOutlineColor] = useState<THREE.Color>(new THREE.Color(0xffffff));

  useEffect(() => {
    // Memory-optimized composer with reduced resolution
    const renderWidth = Math.min(size.width, 1280);
    const renderHeight = Math.min(size.height, 720);
    
    composer.current = new EffectComposer(gl);
    composer.current.setSize(renderWidth, renderHeight);

    const renderPass = new RenderPass(scene, camera);
    composer.current.addPass(renderPass);

    // SINGLE OutlinePass instead of 5 (massive memory savings)
    outlinePass.current = new OutlinePass(
      new THREE.Vector2(renderWidth, renderHeight),
      scene,
      camera
    );
    outlinePass.current.edgeStrength = 8;
    outlinePass.current.edgeThickness = 2;
    outlinePass.current.edgeGlow = 0.5;
    outlinePass.current.pulsePeriod = 2;
    outlinePass.current.visibleEdgeColor = new THREE.Color(0xffffff);
    outlinePass.current.hiddenEdgeColor = new THREE.Color(0x333333);
    composer.current.addPass(outlinePass.current);

    // Simplified FXAA
    const effectFXAA = new ShaderPass(FXAAShader);
    effectFXAA.uniforms['resolution'].value.set(
      1 / renderWidth,
      1 / renderHeight
    );
    composer.current.addPass(effectFXAA);

    return () => {
      composer.current?.dispose();
    };
  }, [gl, scene, camera, size]);

  useEffect(() => {
    // Simplified: collect all hovered/selected objects for single OutlinePass
    const allSelectedObjects: THREE.Object3D[] = [];
    let dominantColor = new THREE.Color(0xffffff);
    let foundPriority = -1;

    groups.forEach((group) => {
      if (group.object) {
        const name = group.name;
        const isActive = meBitsGroups.includes(name) 
          ? group.isFound 
          : (group.isSelected || group.isHovered);

        if (isActive) {
          allSelectedObjects.push(group.object);
          
          // Determine color priority (higher priority overrides)
          let priority = 0;
          let color = new THREE.Color(0xffffff);
          
          if (meBitsGroups.includes(name)) {
            priority = 5;
            color = new THREE.Color(0x10b981);
          } else if (closetGroups.includes(name)) {
            priority = 4;
            color = new THREE.Color(0x4de1ff);
          } else if (goldGroups.includes(name)) {
            priority = 3;
            color = new THREE.Color(0xffd700);
          } else if (redGroups.includes(name)) {
            priority = 2;
            color = new THREE.Color(0xff4444);
          } else if (whiteGroups.includes(name)) {
            priority = 1;
            color = new THREE.Color(0xffffff);
          }
          
          if (priority > foundPriority) {
            foundPriority = priority;
            dominantColor = color;
          }
        }
      }
    });

    setSelectedObjects(allSelectedObjects);
    setCurrentOutlineColor(dominantColor);

    // Update single OutlinePass
    if (outlinePass.current) {
      outlinePass.current.selectedObjects = allSelectedObjects;
      outlinePass.current.visibleEdgeColor = dominantColor;
      outlinePass.current.hiddenEdgeColor = dominantColor.clone().multiplyScalar(0.3);
    }
  }, [groups]);

  // Manage OrbitControls based on selection state
  const [controlsEnabled, setControlsEnabled] = useState<boolean>(true);

  useEffect(() => {
    const anySelected = groups.some((group) =>
      meBitsGroups.includes(group.name) ? (group.isSelected && group.isFound) : group.isSelected
    );
    setControlsEnabled(!anySelected);
  }, [groups]);

  useFrame(() => {
    composer.current?.render();
  }, 1);

  // Prevent body from scrolling when overlay is active
  useEffect(() => {
    const isOverlayActive = groups.some(isGroupSelected) || inspectedModel !== null || foundMessage !== null;
    if (isOverlayActive) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [groups, inspectedModel, foundMessage]);

  // Helper function to determine if a group is selected for info overlay
  const isGroupSelected = (group: GroupData) => {
    if (meBitsGroups.includes(group.name)) {
      return group.isSelected && group.isFound;
    }
    return group.isSelected;
  };

  // Get the first selected group (for Inspect Model button)
  const firstSelectedGroup = groups.find(isGroupSelected);

  return (
    <>
      <Suspense fallback={null}>
        {/* Memory-optimized lighting - removed heavy HDR environment */}
        {/* Using simple lighting instead of HDR for ~200MB savings */}
        <ambientLight intensity={0.8} color={0xffffff} />
        <directionalLight
          intensity={1.0}
          position={[10, 20, 10]}
          castShadow
          shadow-mapSize-width={512}
          shadow-mapSize-height={512}
          shadow-camera-near={0.5}
          shadow-camera-far={50}
          color={0xffffff}
        />
        <pointLight intensity={0.6} position={[-10, 10, -10]} color={0xffccaa} />
        <pointLight intensity={0.6} position={[10, -10, 10]} color={0xaaccff} />
        <hemisphereLight intensity={0.5} groundColor={0x444444} color={0xffffff} />
        <FloatingLight />

        {analyser && (
          <>
            <Zoom analyser={analyser} />
            <Track analyser={analyser} />
          </>
        )}
        {!inspectedModel ? (
          <group>
            <RachosRoom
              analyser={analyser}
              onInspect={handleInspect}
              groups={groups}
              setGroups={setGroups}
              onMeBitFound={handleMeBitFound}
              isPlaying={isPlaying}
            />
          </group>
        ) : (
          <InspectModel
            modelName={inspectedModel}
            onClose={handleCloseInspect}
          />
        )}
      </Suspense>

      <OrbitControls enabled={controlsEnabled} />


      {/* Overlay Container */}
      <Html fullscreen>
        <div className="fixed inset-0 pointer-events-none z-10">
          {/* Music Control - Repositioned for mobile */}
          <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 pointer-events-auto z-20">
            <MusicControl isPlaying={isPlaying} togglePlay={togglePlay} />
          </div>

          {/* MeBits Counter - Enhanced */}
          <motion.div 
            className="absolute top-4 left-4 sm:top-6 sm:left-6 pointer-events-none"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center gap-3 rounded-2xl bg-slate-950/80 backdrop-blur-xl px-4 py-2.5 border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
              {/* Icon */}
              <div className="relative">
                <motion.div
                  className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center"
                  animate={foundMeBitsCount > 0 ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 0.5 }}
                >
                  <span className="text-[10px] font-semibold text-emerald-200">
                    MB
                  </span>
                </motion.div>
                {foundMeBitsCount === meBitsGroups.length && (
                  <motion.div
                    className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                  />
                )}
              </div>
              
              {/* Progress */}
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold text-emerald-400">{foundMeBitsCount}</span>
                  <span className="text-xs text-white/30">/</span>
                  <span className="text-sm text-white/50">{meBitsGroups.length}</span>
                </div>
                <span className="text-[9px] uppercase tracking-[0.15em] text-white/40">MeBits Found</span>
              </div>
              
              {/* Progress bar */}
              <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden ml-2">
                <motion.div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(foundMeBitsCount / meBitsGroups.length) * 100}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            </div>
          </motion.div>

          {/* FFT Status Indicator - Top right */}
          <AnimatePresence>
            {isPlaying && (
              <motion.div
                className="absolute top-4 right-4 sm:top-6 sm:right-6 pointer-events-none"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.4 }}
              >
                <div className="flex items-center gap-2 rounded-full bg-slate-950/80 backdrop-blur-xl px-3 py-1.5 border border-emerald-500/30">
                  <motion.div
                    className="w-2 h-2 rounded-full bg-emerald-500"
                    animate={{ opacity: [1, 0.5, 1], scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                  <span className="text-[10px] uppercase tracking-wider text-emerald-400/80">FFT Active</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Information Container - Professional Redesign */}
          <AnimatePresence>
            {firstSelectedGroup && (
              <motion.div
                className="absolute bottom-4 left-1/2 w-[min(720px,94vw)] -translate-x-1/2 pointer-events-auto sm:bottom-6"
                initial={{ opacity: 0, y: 32, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 32, scale: 0.95 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Glow effect behind card */}
                <motion.div 
                  className="absolute -inset-4 rounded-[32px] blur-3xl"
                  animate={{ opacity: [0.2, 0.35, 0.2] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ 
                    background: `radial-gradient(ellipse at center, ${getOutlineColor(firstSelectedGroup.name)}50, transparent 70%)` 
                  }}
                />
                
                <div className="relative rounded-[28px] border border-white/[0.08] bg-gradient-to-b from-slate-900/95 via-slate-900/98 to-slate-950/98 backdrop-blur-2xl overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.5)]">
                  {/* Accent line at top */}
                  <motion.div 
                    className="absolute top-0 left-0 right-0 h-[2px]"
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    style={{ 
                      background: `linear-gradient(90deg, transparent, ${getOutlineColor(firstSelectedGroup.name)}, transparent)` 
                    }}
                  />
                  
                  {/* Corner accents */}
                  <div 
                    className="absolute top-0 left-0 w-24 h-24 opacity-20"
                    style={{ 
                      background: `radial-gradient(circle at top left, ${getOutlineColor(firstSelectedGroup.name)}40, transparent 70%)` 
                    }}
                  />
                  
                  <div className="p-6 sm:p-7">
                    {/* Header */}
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                      <div className="flex items-center gap-4">
                        {/* Animated indicator */}
                        <motion.div
                          className="relative w-12 h-12 rounded-2xl flex items-center justify-center"
                          style={{ 
                            background: `linear-gradient(135deg, ${getOutlineColor(firstSelectedGroup.name)}20, ${getOutlineColor(firstSelectedGroup.name)}05)`,
                            border: `1px solid ${getOutlineColor(firstSelectedGroup.name)}30`
                          }}
                        >
                          <motion.span
                            className="text-2xl"
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                          >
                            {getCategoryInfo(firstSelectedGroup.name).icon}
                          </motion.span>
                          
                          {/* Pulsing ring */}
                          <motion.div
                            className="absolute inset-0 rounded-2xl"
                            animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                            style={{ border: `2px solid ${getOutlineColor(firstSelectedGroup.name)}` }}
                          />
                        </motion.div>
                        
                        <div>
                          {/* Category badge */}
                          <div 
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] uppercase tracking-[0.2em] font-semibold mb-2"
                            style={{ 
                              background: `${getOutlineColor(firstSelectedGroup.name)}15`,
                              color: getOutlineColor(firstSelectedGroup.name),
                              border: `1px solid ${getOutlineColor(firstSelectedGroup.name)}25`
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
                    
                    {/* Description */}
                    <p className="text-[15px] leading-[1.7] text-slate-300/90 mb-6 max-w-[580px]">
                      {firstSelectedGroup.description}
                    </p>
                    
                    {/* Divider */}
                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-5" />
                    
                    {/* Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <motion.button
                        className="group inline-flex items-center gap-2.5 rounded-2xl px-6 py-3 text-sm font-bold transition-all"
                        style={{ 
                          background: `linear-gradient(135deg, ${getOutlineColor(firstSelectedGroup.name)}, ${getOutlineColor(firstSelectedGroup.name)}cc)`,
                          boxShadow: `0 8px 32px ${getOutlineColor(firstSelectedGroup.name)}35`,
                          color: closetGroups.includes(firstSelectedGroup.name) || meBitsGroups.includes(firstSelectedGroup.name) || whiteGroups.includes(firstSelectedGroup.name) ? '#0f172a' : '#fff'
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

          {/* MeBit Found Popup - Enhanced */}
          <AnimatePresence>
            {foundMessage && (
              <motion.div
                className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-none sm:top-20"
                initial={{ opacity: 0, y: -30, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.9 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="relative flex items-center gap-4 rounded-2xl bg-gradient-to-r from-emerald-600/95 via-teal-500/95 to-cyan-500/95 px-6 py-4 shadow-[0_12px_48px_rgba(16,185,129,0.45)] backdrop-blur-xl border border-white/20">
                  {/* Shimmer effect */}
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
                    <span className="text-xs font-semibold text-white/80">
                      Found
                    </span>
                  </motion.div>
                  
                  <div>
                    <span className="block text-sm font-bold text-white">{foundMessage}</span>
                    <span className="text-[10px] text-white/60 uppercase tracking-wider">Keep exploring!</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Instructions hint - shows briefly on load */}
          <motion.div 
            className="absolute bottom-24 left-1/2 -translate-x-1/2 pointer-events-none sm:bottom-28"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{ duration: 8, times: [0, 0.1, 0.85, 1], delay: 1 }}
          >
            <div className="flex flex-col items-center gap-2 px-6 py-4 rounded-2xl bg-slate-950/60 backdrop-blur-xl border border-white/[0.06]">
              <div className="flex items-center gap-2">
                <p className="text-sm text-white/60 font-medium">
                  Click objects to explore
                </p>
              </div>
              <p className="text-[11px] text-white/40">Find all {meBitsGroups.length} hidden MeBits!</p>
            </div>
          </motion.div>
        </div>
      </Html>
    </>
  );
};

// Helper function to determine outline color based on group name
const getOutlineColor = (name: string): string => {
  if (goldGroups.includes(name)) return '#FFFFFF'; // White shimmer - preserves mesh aesthetics
  if (redGroups.includes(name)) return '#FF6B6B'; // Coral red
  if (whiteGroups.includes(name)) return '#E8E8E8'; // Soft white
  if (closetGroups.includes(name)) return '#4DE1FF'; // Teal
  if (meBitsGroups.includes(name)) return '#10B981'; // Emerald for MeBits
  return '#FFFFFF'; // Default
};

// Helper function to get category label and icon
const getCategoryInfo = (name: string): { label: string; icon: string } => {
  if (goldGroups.includes(name)) return { label: 'Feature', icon: '✦' };
  if (redGroups.includes(name)) return { label: 'Display', icon: '◈' };
  if (whiteGroups.includes(name)) return { label: 'Setup', icon: '◎' };
  if (closetGroups.includes(name)) return { label: 'Gear', icon: '◇' };
  if (meBitsGroups.includes(name)) return { label: 'Collectible', icon: '★' };
  return { label: 'Item', icon: '○' };
};

export default MyRoom;

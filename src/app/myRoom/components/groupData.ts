// src/components/myRoom/groupData.ts
import * as THREE from 'three';

export interface GroupData {
  name: string;
  title: string;
  description: string;
  isSelected: boolean;
  isSelectedTwice: boolean;
  isFound?: boolean;
  isColorBlue?: boolean;
  isHovered?: boolean;
  object?: THREE.Object3D | null;
}

export const groupData: GroupData[] = [
  // Main Feature Groups
  {
    name: 'LightUpSpeakers',
    title: 'Light-Up Speakers',
    description:
      'Audio-reactive speaker system synchronized with FFT frequency analysis. Watch the equalizer bars pulse and dance in real-time when you turn up the music.',
    isSelected: false,
    isSelectedTwice: false,
  },
  {
    name: 'RoomDisplayOne',
    title: 'Work Display',
    description:
      'Primary showcase featuring game development projects, interactive demos, and design system explorations. A curated window into shipped products and experimental work.',
    isSelected: false,
    isSelectedTwice: false,
  },
  {
    name: 'RoomDisplayTwo',
    title: 'Creative Display',
    description:
      'Secondary display highlighting creative tools, generative art experiments, and music production workflows. Lighter render footprint with full interactivity.',
    isSelected: false,
    isSelectedTwice: false,
  },
  {
    name: 'GraphicLeft',
    title: 'Botanical Print',
    description:
      'Hand-selected botanical artwork that brings organic warmth to the space. The natural forms create visual balance against the technical environment.',
    isSelected: false,
    isSelectedTwice: false,
  },
  {
    name: 'GraphicMiddle',
    title: 'Character Study',
    description:
      'Stylized character illustration showcasing illustration fundamentals and personality-driven design. A personal touch that adds character to the workspace.',
    isSelected: false,
    isSelectedTwice: false,
  },
  {
    name: 'GraphicRight',
    title: 'Abstract Composition',
    description:
      'Geometric abstract piece exploring pattern, rhythm, and visual hierarchy. A quiet nod to the structured thinking behind design systems.',
    isSelected: false,
    isSelectedTwice: false,
  },
  {
    name: 'TVMonitor',
    title: 'Entertainment Hub',
    description:
      "Central entertainment display for gaming sessions, streaming, and media consumption. The heart of the room's leisure activities.",
    isSelected: false,
    isSelectedTwice: false,
  },
  {
    name: 'MonitorScreen',
    title: 'Productivity Monitor',
    description:
      'High-resolution workspace monitor optimized for development workflows, design tools, and multitasking. Where ideas become implementations.',
    isSelected: false,
    isSelectedTwice: false,
  },
  {
    name: 'Computer',
    title: 'Workstation',
    description:
      'Custom-built development machine powering all creative and technical work. Optimized for 3D rendering, real-time applications, and media production.',
    isSelected: false,
    isSelectedTwice: false,
  },
  {
    name: 'BunnyEarsCactus',
    title: 'Prickly Pear Cactus',
    description:
      'Low-maintenance desert companion adding a touch of life to the setup. Thrives on neglect—perfect for intensive development sessions.',
    isSelected: false,
    isSelectedTwice: false,
  },
  {
    name: 'KitchenSet',
    title: 'Kitchen Corner',
    description:
      'Compact kitchen vignette featuring essential appliances and cookware. A reminder that fuel is important for long coding sessions.',
    isSelected: false,
    isSelectedTwice: false,
  },
  {
    name: 'Arcade',
    title: 'Retro Arcade',
    description:
      'Classic arcade setup celebrating gaming heritage and pixel-perfect nostalgia. A tribute to the games that sparked the passion for interactive experiences.',
    isSelected: false,
    isSelectedTwice: false,
  },
  {
    name: 'PuzzleShelf',
    title: 'Puzzle Collection',
    description:
      'Curated collection of brain teasers and mechanical puzzles. Each piece represents a love for problem-solving and spatial reasoning.',
    isSelected: false,
    isSelectedTwice: false,
  },

  // Closet / Shelf Items - Gear Category
  {
    name: 'TopShelf',
    title: 'Display Shelf',
    description:
      'Primary display shelf showcasing prized collectibles and hardware. Strategically positioned for optimal visibility and easy access.',
    isSelected: false,
    isSelectedTwice: false,
  },
  {
    name: 'ShelfKeyboard',
    title: 'Mechanical Keyboard',
    description:
      'Compact mechanical keyboard with custom switches and keycaps. Tactile feedback optimized for extended typing sessions and gaming.',
    isSelected: false,
    isSelectedTwice: false,
  },
  {
    name: 'KeyboardMouse',
    title: 'Input Setup',
    description:
      'Primary input peripherals fine-tuned for precision and comfort. Low-latency connections ensure responsive control in any application.',
    isSelected: false,
    isSelectedTwice: false,
  },
  {
    name: 'HeadsetStand',
    title: 'Audio Station',
    description:
      'Dedicated headset stand with integrated cable management. Ready for immersive audio experiences and crystal-clear communication.',
    isSelected: false,
    isSelectedTwice: false,
  },
  {
    name: 'GameZone',
    title: 'Console Rack',
    description:
      "Multi-platform gaming setup housing current and legacy consoles. Cross-platform development and testing capabilities at arm's reach.",
    isSelected: false,
    isSelectedTwice: false,
  },
  {
    name: 'XBOX',
    title: 'Xbox Series X',
    description:
      "Microsoft's flagship console for high-fidelity gaming and development testing. Quick Resume and Game Pass keep the library fresh.",
    isSelected: false,
    isSelectedTwice: false,
  },
  {
    name: 'PS5',
    title: 'PlayStation 5',
    description:
      "Sony's next-gen console featuring the DualSense controller's haptic feedback. Essential for platform-specific testing and exclusives.",
    isSelected: false,
    isSelectedTwice: false,
  },
  {
    name: 'DVDPlayer',
    title: 'Media Player',
    description:
      'Versatile media player supporting physical media and streaming services. Legacy format support for the disc collection.',
    isSelected: false,
    isSelectedTwice: false,
  },
  {
    name: 'CableBox',
    title: 'Connectivity Hub',
    description:
      'Central hub routing signals between devices. Clean cable management keeps the setup looking professional and accessible.',
    isSelected: false,
    isSelectedTwice: false,
  },

  // MeBits - Collectible Category
  {
    name: 'MeBitSanta',
    title: 'Santa MeBit',
    description:
      'Festive seasonal variant with custom holiday materials and jolly pose. A limited collectible celebrating the holiday spirit in pixel form.',
    isSelected: false,
    isSelectedTwice: false,
    isFound: false,
    isColorBlue: false,
  },
  {
    name: 'MeBitRobot',
    title: 'Robot MeBit',
    description:
      'Mechanical companion with articulated joints and glowing accents. This bot represents the fusion of art and engineering.',
    isSelected: false,
    isSelectedTwice: false,
    isFound: false,
    isColorBlue: false,
  },
  {
    name: 'MeBitEnderman',
    title: 'Enderman MeBit',
    description:
      'Tall mysterious figure teleported from block-based dimensions. Handle with care—direct eye contact not recommended.',
    isSelected: false,
    isSelectedTwice: false,
    isFound: false,
    isColorBlue: false,
  },
  {
    name: 'MeBitFatty',
    title: 'Chonk MeBit',
    description:
      'Rotund and proud, this chunky collectible celebrates body positivity in miniature form. Maximum cuddle potential.',
    isSelected: false,
    isSelectedTwice: false,
    isFound: false,
    isColorBlue: false,
  },
  {
    name: 'MeBitCar',
    title: 'Racer MeBit',
    description:
      'Sleek mini vehicle with glossy finish and racing stripes. Built for speed, displayed for style.',
    isSelected: false,
    isSelectedTwice: false,
    isFound: false,
    isColorBlue: false,
  },
  {
    name: 'MeBitUFO',
    title: 'UFO MeBit',
    description:
      "Hovering extraterrestrial craft with glowing propulsion effects. The truth is out there, and it's collectible.",
    isSelected: false,
    isSelectedTwice: false,
    isFound: false,
    isColorBlue: false,
  },
  {
    name: 'MeBitPlant',
    title: 'Sprout MeBit',
    description:
      'Organic collectible featuring translucent leaves and natural materials. Proof that even pixels can be green.',
    isSelected: false,
    isSelectedTwice: false,
    isFound: false,
    isColorBlue: false,
  },
  {
    name: 'MeBitBoat',
    title: 'Sailor MeBit',
    description:
      'Maritime vessel with polished hull and nautical details. Ready to navigate any digital seas.',
    isSelected: false,
    isSelectedTwice: false,
    isFound: false,
    isColorBlue: false,
  },
  {
    name: 'MeBitCthulu',
    title: 'Cthulhu MeBit',
    description:
      'Eldritch horror rendered adorable. Ancient cosmic dread has never looked so huggable.',
    isSelected: false,
    isSelectedTwice: false,
    isFound: false,
    isColorBlue: false,
  },
  {
    name: 'MeBitBalloon',
    title: 'Balloon MeBit',
    description:
      'Buoyant buddy floating through the space. Light, airy, and impossible not to smile at.',
    isSelected: false,
    isSelectedTwice: false,
    isFound: false,
    isColorBlue: false,
  },
  {
    name: 'MeSubBit',
    title: 'Submarine MeBit',
    description:
      'Deep-sea explorer with periscope and metallic finish. Exploring the depths of creativity.',
    isSelected: false,
    isSelectedTwice: false,
    isFound: false,
    isColorBlue: false,
  },
  {
    name: 'MeBitHelmet',
    title: 'Helmet MeBit',
    description:
      'Protective gear rendered in collectible form. Safety first, style always.',
    isSelected: false,
    isSelectedTwice: false,
    isFound: false,
    isColorBlue: false,
  },
  {
    name: 'MeBitTerranium',
    title: 'Terrarium MeBit',
    description:
      'Miniature ecosystem under glass, complete with tiny plants and decorative stones. A world within a world.',
    isSelected: false,
    isSelectedTwice: false,
    isFound: false,
    isColorBlue: false,
  },
  {
    name: 'MeBitChandelier',
    title: 'Chandelier MeBit',
    description:
      'Elegant lighting fixture transformed into collectible art. Sparkles and sophistication in miniature.',
    isSelected: false,
    isSelectedTwice: false,
    isFound: false,
    isColorBlue: false,
  },
];

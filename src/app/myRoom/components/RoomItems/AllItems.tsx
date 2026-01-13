// src/components/myRoom/modelMap.ts

import React from 'react';

// Import all MeBits and other models
import { MeBitBalloon } from "./RoomMeBits/MeBitBalloon";
import { MeBitBoat } from "./RoomMeBits/MeBitBoat";
import { MeBitCar } from "./RoomMeBits/MeBitCar";
import { MeBitChandelier } from "./RoomMeBits/MeBitChandelier";
import { MeBitCthulu } from "./RoomMeBits/MeBitCthulu";
import { MeBitEnderman } from "./RoomMeBits/MeBitEnderman";
import { MeBitFatty } from "./RoomMeBits/MeBitFatty";
import { MeBitHelmet } from "./RoomMeBits/MeBitHelmet";
import { MeBitPlant } from "./RoomMeBits/MeBitPlant";
import { MeBitRobot } from "./RoomMeBits/MeBitRobot";
import { MeBitSanta } from "./RoomMeBits/MeBitSanta";
import { MeBitSub } from './RoomMeBits/MeBitSub';
import { MeBitTerranium } from "./RoomMeBits/MeBitTerranium";
import { MeBitUfo } from './RoomMeBits/MeBitUFO';
import { MeBitUfoGames } from './RoomMeBits/MeBitUFOGames';

// Import other models as needed
import { RachosRoomV1 } from "./RoomDisplays/RachosRoomV1";
import { RachosRoomV2 } from "./RoomDisplays/RachosRoomV2";
import { RoomDisplayOne } from './RoomDisplays/RoomDisplayOne';
import { RoomDisplayTwo } from "./RoomDisplays/RoomDisplayTwo";
import { Arcade } from "./RoomInterest/Arcade";
import { KitchenSet } from "./RoomInterest/KitchenSet";
import { LightUpSpeakers } from "./RoomInterest/LightUpSpeakers";
import { PricklyPearCactus } from "./RoomInterest/PricklyPearCactus";
import { PuzzleShelf } from "./RoomInterest/PuzzleShelf";

// Define the model map
const modelMap: Record<string, React.ComponentType<any>> = {
  // Rooms
  RoomDisplayOne,
  RoomDisplayTwo,
  RachosRoomV1,
  RachosRoomV2,

  // MeBits
  MeBitSanta,
  MeBitRobot,
  MeBitUfoGames,
  MeBitSub,
  MeBitTerranium,
  MeBitUfo,
  MeBitUFO: MeBitUfo,
  MeBitFatty,
  MeBitChandelier,
  MeBitCthulu,
  MeBitHelmet,
  MeBitEnderman,
  MeBitPlant,
  MeBitBalloon,
  MeBitBoat,
  MeBitCar,
  MeSubBit: MeBitSub,

  // Interests
  PricklyPearCactus,
  BunnyEarsCactus: PricklyPearCactus,
  PuzzleShelf,
  Arcade,
  LightUpSpeakers,
  KitchenSet,

  // Add any additional models here
};

export default modelMap;

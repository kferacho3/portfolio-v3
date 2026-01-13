// src/components/UfoShip.tsx

import { useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, { ReactNode, useRef } from 'react';
import * as THREE from 'three';
import { GLTF } from 'three-stdlib';

// Define the structure of your GLTF model
type GLTFResult = GLTF & {
  nodes: {
    UfoPurpleBod1: THREE.Mesh;
    Curve391: THREE.Mesh;
    Curve391_1: THREE.Mesh;
    Curve391_2: THREE.Mesh;
    Curve391_3: THREE.Mesh;
    Curve123: THREE.Mesh;
    Curve123_1: THREE.Mesh;
    Curve123_2: THREE.Mesh;
    Curve123_3: THREE.Mesh;
    Curve123_4: THREE.Mesh;
    Curve123_5: THREE.Mesh;
    Curve123_6: THREE.Mesh;
    Curve123_7: THREE.Mesh;
    Curve123_8: THREE.Mesh;
    Curve123_9: THREE.Mesh;
    Curve123_10: THREE.Mesh;
    Curve123_11: THREE.Mesh;
    Curve123_12: THREE.Mesh;
    Curve123_13: THREE.Mesh;
    Curve123_14: THREE.Mesh;
    Curve123_15: THREE.Mesh;
    Curve123_16: THREE.Mesh;
    Curve123_17: THREE.Mesh;
    Curve123_18: THREE.Mesh;
    Curve123_19: THREE.Mesh;
    Curve123_20: THREE.Mesh;
    Curve123_21: THREE.Mesh;
    Curve123_22: THREE.Mesh;
    Curve123_23: THREE.Mesh;
    Curve123_24: THREE.Mesh;
    Curve123_25: THREE.Mesh;
    Curve123_26: THREE.Mesh;
    Curve123_27: THREE.Mesh;
    Curve123_28: THREE.Mesh;
    Curve123_29: THREE.Mesh;
    Curve123_30: THREE.Mesh;
    Curve123_31: THREE.Mesh;
    Curve123_32: THREE.Mesh;
    Curve063: THREE.Mesh;
    Curve063_1: THREE.Mesh;
    Curve063_2: THREE.Mesh;
    Curve063_3: THREE.Mesh;
    Curve011: THREE.Mesh;
    Curve011_1: THREE.Mesh;
    Curve011_2: THREE.Mesh;
    Curve011_3: THREE.Mesh;
    Curve125: THREE.Mesh;
    Curve125_1: THREE.Mesh;
    Curve125_2: THREE.Mesh;
    Curve125_3: THREE.Mesh;
    Curve127: THREE.Mesh;
    Curve127_1: THREE.Mesh;
    Curve127_2: THREE.Mesh;
    Curve127_3: THREE.Mesh;
    Curve294: THREE.Mesh;
    Curve294_1: THREE.Mesh;
    Curve294_2: THREE.Mesh;
    Curve294_3: THREE.Mesh;
    Curve009: THREE.Mesh;
    Curve009_1: THREE.Mesh;
    Curve009_2: THREE.Mesh;
    Curve009_3: THREE.Mesh;
    ['Cylinder015_02_-_Default_0010']: THREE.Mesh;
    ['Cylinder015_04_-_Default_0']: THREE.Mesh;
    ['Cylinder015_05_-_Default_0012']: THREE.Mesh;
    Object_2008: THREE.Mesh;
    pCube1_PistolTrigger_0002: THREE.Mesh;
    pCylinder7_PistolBody_0002: THREE.Mesh;
    pHelix1_PistolRings_0002: THREE.Mesh;
    pTorus6_PistolType_0002: THREE.Mesh;
    Spinner004: THREE.Mesh;
  };
  materials: {
    PaletteMaterial001: THREE.MeshStandardMaterial;
    PaletteMaterial002: THREE.MeshStandardMaterial;
    PaletteMaterial003: THREE.MeshStandardMaterial;
    PaletteMaterial004: THREE.MeshStandardMaterial;
    PaletteMaterial005: THREE.MeshStandardMaterial;
    PaletteMaterial006: THREE.MeshStandardMaterial;
    PaletteMaterial007: THREE.MeshStandardMaterial;
    PaletteMaterial008: THREE.MeshStandardMaterial;
    ['02_-_Default']: THREE.MeshStandardMaterial;
    ['04_-_Default']: THREE.MeshStandardMaterial;
    ['05_-_Default']: THREE.MeshStandardMaterial;
    ['PistolTrigger.002']: THREE.MeshStandardMaterial;
    ['PistolBody.002']: THREE.MeshStandardMaterial;
    ['PistolRings.002']: THREE.MeshStandardMaterial;
    ['PistolType.002']: THREE.MeshStandardMaterial;
    material_0?: THREE.MeshBasicMaterial;
    ['material_0.004']: THREE.MeshBasicMaterial;
    [key: string]: THREE.Material;
  };
};

// Define the possible action names from your animations
type ActionName =
  | 'AlienOrange'
  | 'AlienPurple'
  | 'AlienRLeft'
  | 'AlienRMiddle'
  | 'AlienRRight'
  | 'AliensGreenFront.018Action'
  | 'AliensGreenLeft.001Action.003'
  | 'AliensGreenFront.005Action';

// Map action names to THREE.AnimationAction
type GLTFActions = Record<ActionName, THREE.AnimationAction>;

// Define the props for the Rig component
interface RigProps { children: ReactNode; }

// Rig component to handle camera and lighting
export const Rig: React.FC<RigProps> = ({ children }) => {
  const group = useRef<THREE.Group>(null!);
  const { camera, mouse } = useThree();
  useFrame(() => {
    const offset = mouse.y * 0.1;
    const position: [number, number, number] = [0, Math.max(0 + offset, 2), 8];
    group.current.position.set(...position);
    camera.lookAt(0, 0, 0);
  });
  return <group ref={group}><pointLight distance={400} position={[0, 100, -420]} intensity={5} color="indianred" />{children}</group>;
};

// Define the props for the UfoShip component
type UfoShipProps = JSX.IntrinsicElements['group'] & {
  playerRef: React.MutableRefObject<THREE.Group>;
  bodyRef: React.MutableRefObject<THREE.Group>;
};


// UfoShip component
const UfoShip: React.FC<UfoShipProps> = ({ playerRef, bodyRef, ...props }) => {
  const cross = useRef<THREE.Group>(null);
  const target = useRef<THREE.Group>(null);
  const { nodes, materials, animations } = useGLTF('/fun/models/UFOgames.glb') as GLTFResult;
 // const { actions } = useAnimations<ActionName>(animations, playerRef);
  const lightgreen = new THREE.Color('lightgreen'); const hotpink = new THREE.Color('hotpink');
  const laserMaterial = new THREE.MeshBasicMaterial({ color: lightgreen }); const crossMaterial = new THREE.MeshBasicMaterial({ color: hotpink, fog: false });
  useFrame(() => { crossMaterial.color = lightgreen; });
  return <group ref={playerRef}><group scale={1} ref={bodyRef} {...props} dispose={null}>
    {/* Cross Group */}
    <group scale={0.005} ref={cross} position={[0,0,0]} name="cross">
      <mesh renderOrder={1000} material={crossMaterial}><boxGeometry args={[20,2,2]} /></mesh>
      <mesh renderOrder={1000} material={crossMaterial}><boxGeometry args={[2,20,2]} /></mesh>
    </group>
    {/* Target Group */}
    <group ref={target} scale={0.005} position={[0,0,0]} name="target">
      <mesh position={[0,20,0]} renderOrder={1000} material={crossMaterial}><boxGeometry args={[40,2,2]} /></mesh>
      <mesh position={[0,-20,0]} renderOrder={1000} material={crossMaterial}><boxGeometry args={[40,2,2]} /></mesh>
      <mesh position={[20,0,0]} renderOrder={1000} material={crossMaterial}><boxGeometry args={[2,40,2]} /></mesh>
      <mesh position={[-20,0,0]} renderOrder={1000} material={crossMaterial}><boxGeometry args={[2,40,2]} /></mesh>
    </group>
    {/* Rig Component for Camera and Lighting */}
    <Rig><group rotation={[0, Math.PI, 0]}><group name="Scene">
      {/* UfoPurpleBod1 Mesh */}
      <mesh name="UfoPurpleBod1" castShadow receiveShadow geometry={nodes.UfoPurpleBod1.geometry} material={materials.PaletteMaterial001} position={[1.247,-1.158,0.088]} rotation={[1.57,0,-3.141]} scale={[4.877,0.516,4.877]} />
      {/* Empty Group */}
      <group name="Empty" position={[0.944,-1.007,0.119]} rotation={[1.57,0,0]} scale={[0.571,0.938,0.571]}>
        {/* AlienOrange Group */}
        <group name="AlienOrange" position={[-2.652,0.039,-1.468]} rotation={[0,0,-Math.PI]} scale={[7.63,1,7.63]}>
          <mesh name="Curve391" castShadow receiveShadow geometry={nodes.Curve391.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve391_1" castShadow receiveShadow geometry={nodes.Curve391_1.geometry} material={materials.PaletteMaterial002} />
          <mesh name="Curve391_2" castShadow receiveShadow geometry={nodes.Curve391_2.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve391_3" castShadow receiveShadow geometry={nodes.Curve391_3.geometry} material={materials.PaletteMaterial001} />
        </group>
        {/* AlienPurple Group */}
        <group name="AlienPurple" position={[-0.744,0.011,-1.588]} rotation={[0,0,-Math.PI]} scale={[7.63,1,7.63]}>
          <mesh name="Curve123" castShadow receiveShadow geometry={nodes.Curve123.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_1" castShadow receiveShadow geometry={nodes.Curve123_1.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_2" castShadow receiveShadow geometry={nodes.Curve123_2.geometry} material={materials.PaletteMaterial003} />
          <mesh name="Curve123_3" castShadow receiveShadow geometry={nodes.Curve123_3.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_4" castShadow receiveShadow geometry={nodes.Curve123_4.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_5" castShadow receiveShadow geometry={nodes.Curve123_5.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_6" castShadow receiveShadow geometry={nodes.Curve123_6.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_7" castShadow receiveShadow geometry={nodes.Curve123_7.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_8" castShadow receiveShadow geometry={nodes.Curve123_8.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_9" castShadow receiveShadow geometry={nodes.Curve123_9.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_10" castShadow receiveShadow geometry={nodes.Curve123_10.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_11" castShadow receiveShadow geometry={nodes.Curve123_11.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_12" castShadow receiveShadow geometry={nodes.Curve123_12.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_13" castShadow receiveShadow geometry={nodes.Curve123_13.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_14" castShadow receiveShadow geometry={nodes.Curve123_14.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_15" castShadow receiveShadow geometry={nodes.Curve123_15.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_16" castShadow receiveShadow geometry={nodes.Curve123_16.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_17" castShadow receiveShadow geometry={nodes.Curve123_17.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_18" castShadow receiveShadow geometry={nodes.Curve123_18.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_19" castShadow receiveShadow geometry={nodes.Curve123_19.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_20" castShadow receiveShadow geometry={nodes.Curve123_20.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_21" castShadow receiveShadow geometry={nodes.Curve123_21.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_22" castShadow receiveShadow geometry={nodes.Curve123_22.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_23" castShadow receiveShadow geometry={nodes.Curve123_23.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_24" castShadow receiveShadow geometry={nodes.Curve123_24.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_25" castShadow receiveShadow geometry={nodes.Curve123_25.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_26" castShadow receiveShadow geometry={nodes.Curve123_26.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_27" castShadow receiveShadow geometry={nodes.Curve123_27.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_28" castShadow receiveShadow geometry={nodes.Curve123_28.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_29" castShadow receiveShadow geometry={nodes.Curve123_29.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_30" castShadow receiveShadow geometry={nodes.Curve123_30.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_31" castShadow receiveShadow geometry={nodes.Curve123_31.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve123_32" castShadow receiveShadow geometry={nodes.Curve123_32.geometry} material={materials.PaletteMaterial001} />
        </group>
        {/* AlienRLeft Group */}
        <group name="AlienRLeft" position={[-1.656,-0.184,-2.157]} rotation={[1.57,0,-3.141]} scale={[3.001,0.111,3.001]}>
          <mesh name="Curve063" castShadow receiveShadow geometry={nodes.Curve063.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve063_1" castShadow receiveShadow geometry={nodes.Curve063_1.geometry} material={materials.PaletteMaterial004} />
          <mesh name="Curve063_2" castShadow receiveShadow geometry={nodes.Curve063_2.geometry} material={materials.PaletteMaterial005} />
          <mesh name="Curve063_3" castShadow receiveShadow geometry={nodes.Curve063_3.geometry} material={materials.PaletteMaterial006} />
        </group>
        {/* AlienRMiddle Group */}
        <group name="AlienRMiddle" position={[-1.656,-0.184,-2.157]} rotation={[0,0,Math.PI]} scale={[3.001,0.111,3.001]}>
          <mesh name="Curve011" castShadow receiveShadow geometry={nodes.Curve011.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve011_1" castShadow receiveShadow geometry={nodes.Curve011_1.geometry} material={materials.PaletteMaterial004} />
          <mesh name="Curve011_2" castShadow receiveShadow geometry={nodes.Curve011_2.geometry} material={materials.PaletteMaterial005} />
          <mesh name="Curve011_3" castShadow receiveShadow geometry={nodes.Curve011_3.geometry} material={materials.PaletteMaterial006} />
        </group>
        {/* AlienRRight Group */}
        <group name="AlienRRight" position={[-1.656,-0.184,-2.157]} rotation={[0,0,-Math.PI]} scale={[3.001,0.111,3.001]}>
          <mesh name="Curve125" castShadow receiveShadow geometry={nodes.Curve125.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve125_1" castShadow receiveShadow geometry={nodes.Curve125_1.geometry} material={materials.PaletteMaterial004} />
          <mesh name="Curve125_2" castShadow receiveShadow geometry={nodes.Curve125_2.geometry} material={materials.PaletteMaterial005} />
          <mesh name="Curve125_3" castShadow receiveShadow geometry={nodes.Curve125_3.geometry} material={materials.PaletteMaterial006} />
        </group>
      </group>
      {/* Empty001 Group */}
      <group name="Empty001" position={[1.655,2.463,0.022]} rotation={[-1.695,0,0]}>
        {/* AliensGreenLeft Group */}
        <group name="AliensGreenLeft" position={[-1.678,0.204,-2.166]} rotation={[0,-0.262,-3.141]} scale={[2.847,0.29,2.84]}>
          <mesh name="Curve127" castShadow receiveShadow geometry={nodes.Curve127.geometry} material={materials.PaletteMaterial007} />
          <mesh name="Curve127_1" castShadow receiveShadow geometry={nodes.Curve127_1.geometry} material={materials.PaletteMaterial008} />
          <mesh name="Curve127_2" castShadow receiveShadow geometry={nodes.Curve127_2.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve127_3" castShadow receiveShadow geometry={nodes.Curve127_3.geometry} material={materials.PaletteMaterial001} />
        </group>
        {/* AliensGreenMiddle Group */}
        <group name="AliensGreenMiddle" position={[-1.665,0.169,-2.243]} rotation={[0,-Math.PI/4,-3.142]} scale={[3.876,0.24,2.84]}>
          <mesh name="Curve294" castShadow receiveShadow geometry={nodes.Curve294.geometry} material={materials.PaletteMaterial007} />
          <mesh name="Curve294_1" castShadow receiveShadow geometry={nodes.Curve294_1.geometry} material={materials.PaletteMaterial008} />
          <mesh name="Curve294_2" castShadow receiveShadow geometry={nodes.Curve294_2.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve294_3" castShadow receiveShadow geometry={nodes.Curve294_3.geometry} material={materials.PaletteMaterial001} />
        </group>
        {/* AliensGreenRight Group */}
        <group name="AliensGreenRight" position={[-1.678,0.204,-2.166]} rotation={[3.14,-0.287,-3.141]} scale={[2.998,0.177,4.567]}>
          <mesh name="Curve009" castShadow receiveShadow geometry={nodes.Curve009.geometry} material={materials.PaletteMaterial007} />
          <mesh name="Curve009_1" castShadow receiveShadow geometry={nodes.Curve009_1.geometry} material={materials.PaletteMaterial008} />
          <mesh name="Curve009_2" castShadow receiveShadow geometry={nodes.Curve009_2.geometry} material={materials.PaletteMaterial001} />
          <mesh name="Curve009_3" castShadow receiveShadow geometry={nodes.Curve009_3.geometry} material={materials.PaletteMaterial001} />
        </group>
      </group>
      {/* Cylinder015_02_-_Default_0010 Mesh */}
      <mesh name="Cylinder015_02_-_Default_0010" castShadow receiveShadow geometry={nodes['Cylinder015_02_-_Default_0010'].geometry} material={materials['02_-_Default']} position={[-0.011,-0.737,-0.28]} rotation={[0,-0.01,Math.PI/2]} scale={0.009} />
      {/* Cylinder015_04_-_Default_0 Mesh */}
      <mesh name="Cylinder015_04_-_Default_0" castShadow receiveShadow geometry={nodes['Cylinder015_04_-_Default_0'].geometry} material={materials['04_-_Default']} position={[-0.011,-0.737,-0.28]} rotation={[0,-0.01,Math.PI/2]} scale={[0.562,0.574,0.562]} />
      {/* Cylinder015_05_-_Default_0012 Mesh */}
      <mesh name="Cylinder015_05_-_Default_0012" castShadow receiveShadow geometry={nodes['Cylinder015_05_-_Default_0012'].geometry} material={materials['05_-_Default']} position={[-0.018,-0.836,0.42]} rotation={[0,-0.01,Math.PI/2]} scale={[0.576,0.588,0.576]} />
      {/* Object_2008 Mesh */}
      <mesh
        name="Object_2008"
        castShadow
        receiveShadow
        geometry={nodes.Object_2008.geometry}
        material={materials.material_0 ?? materials.PaletteMaterial001}
        position={[-0.012, -0.867, 0.103]}
        rotation={[Math.PI / 2, 0, Math.PI]}
        scale={[0.031, 0.023, 0.03]}
      />
      {/* pCube1_PistolTrigger_0002 Mesh */}
      <mesh name="pCube1_PistolTrigger_0002" castShadow receiveShadow geometry={nodes.pCube1_PistolTrigger_0002.geometry} material={materials['PistolTrigger.002']} position={[-0.037,-0.813,0.51]} rotation={[1.891,1.54,-1.938]} scale={[0.248,0.895,0.248]} />
      {/* pCylinder7_PistolBody_0002 Mesh */}
      <mesh name="pCylinder7_PistolBody_0002" castShadow receiveShadow geometry={nodes.pCylinder7_PistolBody_0002.geometry} material={materials['PistolBody.002']} position={[-0.033,-0.733,0.547]} rotation={[1.891,1.54,-1.938]} scale={0.283} />
      {/* pHelix1_PistolRings_0002 Mesh */}
      <mesh name="pHelix1_PistolRings_0002" castShadow receiveShadow geometry={nodes.pHelix1_PistolRings_0002.geometry} material={materials['PistolRings.002']} position={[-0.031,-0.72,0.589]} rotation={[1.891,1.54,2.774]} scale={[0.281,0.292,0.292]} />
      {/* pTorus6_PistolType_0002 Mesh */}
      <mesh name="pTorus6_PistolType_0002" castShadow receiveShadow geometry={nodes.pTorus6_PistolType_0002.geometry} material={materials['PistolType.002']} position={[-0.008,-0.719,0.439]} rotation={[1.523,-0.079,-1.582]} scale={0.258} />
      {/* Spinner004 Mesh */}
      <mesh name="Spinner004" castShadow receiveShadow geometry={nodes.Spinner004.geometry} material={materials['material_0.004']} position={[-1.001,-0.757,-0.4]} rotation={[1.531,-1.437,3.124]} scale={[0.004,0.023,0.005]} />
    </group> </group>  </Rig></group></group>;
};
useGLTF.preload('/fun/models/UFOgames.glb');

export default UfoShip;

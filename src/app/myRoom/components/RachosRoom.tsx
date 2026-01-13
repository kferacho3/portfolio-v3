// src/components/myRoom/RachosRoom.tsx

'use client';

import { useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTF } from 'three-stdlib';

// Define a GLTFResult interface for TypeScript
interface GLTFResult extends GLTF {
  nodes: Record<string, THREE.Mesh>;
  materials: Record<string, THREE.Material>;
}

interface RachosRoomProps {
  analyser: THREE.AudioAnalyser;
}

const RachosRoom = ({ analyser }: RachosRoomProps) => {
  const group = useRef<THREE.Group>(null!);

  // Cast useGLTF result as unknown first, then as GLTFResult
  const { nodes, materials, animations } = useGLTF(
    'https://racho-devs.s3.us-east-2.amazonaws.com/about/glbDivs/RachosRoom.glb'
  ) as unknown as GLTFResult;

  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    Object.values(actions).forEach((action) => action?.play());
  }, [actions]);

  useFrame(() => {
    analyser.getFrequencyData();
    const data = analyser.getAverageFrequency();

    // Access specific mesh and cast it to THREE.Mesh
    const targetMesh = nodes.Object_24;

    // Ensure targetMesh exists and is a Mesh before manipulating
    if (targetMesh instanceof THREE.Mesh) {
      targetMesh.rotation.y += data * 0.0001;
      targetMesh.scale.setScalar(1 + data / 256);
    }
  });

  return (
    <group scale={0.01} ref={group} dispose={null}>
      <group name="Scene">
        <group
          name="Bone008_09"
          position={[-2.552, 7.511, -2.466]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        <group
          name="Bone014_015"
          position={[4.977, 4.941, 5.128]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        <group
          name="Bone015_016"
          position={[0, 4.941, 5.128]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        <group
          name="Chandelier"
          position={[-61.686, 205.455, -176.423]}
          scale={[22.267, 20.675, 22.057]}
        >
          <group name="circle" />
          <group name="circle2" />
          <group name="Inner_Sphere_Chandelier">
            <group name="Inner_Sphere_Chandelier001">
              <mesh
                name="Inner_Sphere_Chandelier_1"
                geometry={nodes.Inner_Sphere_Chandelier_1.geometry}
                material={materials.PaletteMaterial008}
              />
              <mesh
                name="Inner_Sphere_Chandelier_2"
                geometry={nodes.Inner_Sphere_Chandelier_2.geometry}
                material={materials.PaletteMaterial005}
              />
            </group>
          </group>
          <group name="Outer_Sphere_Chandelier">
            <group name="Outer_Sphere_Chandelier001">
              <mesh
                name="Outer_Sphere_Chandelier_1"
                geometry={nodes.Outer_Sphere_Chandelier_1.geometry}
                material={materials.PaletteMaterial001}
              />
              <mesh
                name="Outer_Sphere_Chandelier_2"
                geometry={nodes.Outer_Sphere_Chandelier_2.geometry}
                material={materials.PaletteMaterial008}
              />
              <mesh
                name="Outer_Sphere_Chandelier_3"
                geometry={nodes.Outer_Sphere_Chandelier_3.geometry}
                material={materials.PaletteMaterial009}
              />
            </group>
          </group>
        </group>
        <group
          name="GLTF_SceneRootNode"
          position={[11.555, 67.456, -86.92]}
          rotation={[0, -0.827, 0]}
          scale={4.535}
        >
          <group
            name="Circle001_11"
            position={[0.991, 1.999, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <mesh
              name="Object_24"
              geometry={nodes.Object_24.geometry}
              material={materials.PaletteMaterial001}
            />
          </group>
          <group
            name="Circle003_13"
            position={[0.991, 0.599, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <mesh
              name="Object_28"
              geometry={nodes.Object_28.geometry}
              material={materials.PaletteMaterial001}
            />
          </group>
          <group
            name="Circle005_16"
            position={[0.991, 1.999, -4.4]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <mesh
              name="Object_34"
              geometry={nodes.Object_34.geometry}
              material={materials.PaletteMaterial001}
            />
          </group>
          <group
            name="Circle007_18"
            position={[0.991, 0.599, -4.4]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <mesh
              name="Object_38"
              geometry={nodes.Object_38.geometry}
              material={materials.PaletteMaterial001}
            />
          </group>
          <group
            name="Circle009_4"
            position={[0.891, 0.304, -2.9]}
            rotation={[0, 0, Math.PI / 2]}
            scale={0.822}
          >
            <mesh
              name="Object_12001"
              geometry={nodes.Object_12001.geometry}
              material={materials.PaletteMaterial001}
            />
          </group>
          <group
            name="Circle011_1"
            position={[0.891, 0.304, -1.5]}
            rotation={[0, 0, Math.PI / 2]}
            scale={0.822}
          >
            <mesh
              name="Object_6001"
              geometry={nodes.Object_6001.geometry}
              material={materials.PaletteMaterial001}
            />
          </group>
          <group
            name="Circle013_7"
            position={[0.891, 1.36, -2.2]}
            rotation={[0, 0, Math.PI / 2]}
            scale={0.822}
          >
            <mesh
              name="Object_18001"
              geometry={nodes.Object_18001.geometry}
              material={materials.PaletteMaterial001}
            />
          </group>
        </group>
        <group
          name="GLTF_SceneRootNode001"
          position={[13.871, 68.227, -98.518]}
          rotation={[0, 0.717, 0]}
          scale={[4.452, 4.129, 3.664]}
        >
          <group name="equalizer_35">
            <group
              name="baseCover001_0"
              position={[0, 1.797, 0]}
              rotation={[-Math.PI, 0, 0]}
              scale={[1.023, 1.804, 1.022]}
            >
              <mesh
                name="Object_5001"
                geometry={nodes.Object_5001.geometry}
                material={materials.PaletteMaterial007}
              />
            </group>
            <group name="glass_1">
              <mesh
                name="Object_7001"
                geometry={nodes.Object_7001.geometry}
                material={materials.PaletteMaterial010}
              />
            </group>
            <group
              name="indicator10_3"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.321, 1]}
            >
              <mesh
                name="Object_11001"
                geometry={nodes.Object_11001.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator11_4"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.542, 1]}
            >
              <mesh
                name="Object_13001"
                geometry={nodes.Object_13001.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator12_5"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.125, 1]}
            >
              <mesh
                name="Object_15001"
                geometry={nodes.Object_15001.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator13_6"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.791, 1]}
            >
              <mesh
                name="Object_17001"
                geometry={nodes.Object_17001.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator14_7"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.436, 1]}
            >
              <mesh
                name="Object_19001"
                geometry={nodes.Object_19001.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator15_8"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.197, 1]}
            >
              <mesh
                name="Object_21001"
                geometry={nodes.Object_21001.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator16_9"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.412, 1]}
            >
              <mesh
                name="Object_23"
                geometry={nodes.Object_23.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator17_10"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.351, 1]}
            >
              <mesh
                name="Object_25"
                geometry={nodes.Object_25.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator18_11"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.619, 1]}
            >
              <mesh
                name="Object_27"
                geometry={nodes.Object_27.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator19_12"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.953, 1]}
            >
              <mesh
                name="Object_29"
                geometry={nodes.Object_29.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator1_2"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.291, 1]}
            >
              <mesh
                name="Object_9001"
                geometry={nodes.Object_9001.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator20_14"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.551, 1]}
            >
              <mesh
                name="Object_33"
                geometry={nodes.Object_33.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator21_15"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.544, 1]}
            >
              <mesh
                name="Object_35"
                geometry={nodes.Object_35.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator22_16"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.713, 1]}
            >
              <mesh
                name="Object_37"
                geometry={nodes.Object_37.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator23_17"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.856, 1]}
            >
              <mesh
                name="Object_39"
                geometry={nodes.Object_39.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator24_18"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.202, 1]}
            >
              <mesh
                name="Object_41"
                geometry={nodes.Object_41.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator25_19"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.129, 1]}
            >
              <mesh
                name="Object_43"
                geometry={nodes.Object_43.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator26_20"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.826, 1]}
            >
              <mesh
                name="Object_45"
                geometry={nodes.Object_45.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator27_21"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.374, 1]}
            >
              <mesh
                name="Object_47"
                geometry={nodes.Object_47.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator28_22"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.847, 1]}
            >
              <mesh
                name="Object_49"
                geometry={nodes.Object_49.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator29_23"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.037, 1]}
            >
              <mesh
                name="Object_51"
                geometry={nodes.Object_51.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator2_13"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.453, 1]}
            >
              <mesh
                name="Object_31"
                geometry={nodes.Object_31.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator30_25"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.362, 1]}
            >
              <mesh
                name="Object_55"
                geometry={nodes.Object_55.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator31_26"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.041, 1]}
            >
              <mesh
                name="Object_57"
                geometry={nodes.Object_57.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator32_27"
              position={[0, 0.01, 0]}
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.925, 1]}
            >
              <mesh
                name="Object_59"
                geometry={nodes.Object_59.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator3_24"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.797, 1]}
            >
              <mesh
                name="Object_53"
                geometry={nodes.Object_53.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator4_28"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.715, 1]}
            >
              <mesh
                name="Object_61"
                geometry={nodes.Object_61.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator5_29"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.567, 1]}
            >
              <mesh
                name="Object_63"
                geometry={nodes.Object_63.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator6_30"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.031, 1]}
            >
              <mesh
                name="Object_65"
                geometry={nodes.Object_65.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator7_31"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.771, 1]}
            >
              <mesh
                name="Object_67"
                geometry={nodes.Object_67.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator8_32"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.591, 1]}
            >
              <mesh
                name="Object_69"
                geometry={nodes.Object_69.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="indicator9_33"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.524, 1]}
            >
              <mesh
                name="Object_71"
                geometry={nodes.Object_71.geometry}
                material={materials.equalizer}
              />
            </group>
            <group
              name="linees_34"
              rotation={[-Math.PI, 0, 0]}
              scale={[0.99, 1.8, 0.99]}
            >
              <mesh
                name="Object_73"
                geometry={nodes.Object_73.geometry}
                material={materials.PaletteMaterial001}
              />
              <mesh
                name="Object_74"
                geometry={nodes.Object_74.geometry}
                material={materials['Material.014']}
              />
            </group>
          </group>
        </group>
        <mesh
          name="Object_5013"
          geometry={nodes.Object_5013.geometry}
          material={materials.PaletteMaterial001}
        />
        <mesh
          name="Object_5729"
          geometry={nodes.Object_5729.geometry}
          material={materials.equalizer}
        />
        <mesh
          name="Object_51183"
          geometry={nodes.Object_51183.geometry}
          material={materials.frontColor}
        />
        <mesh
          name="Object_51382"
          geometry={nodes.Object_51382.geometry}
          material={materials.PaletteMaterial007}
        />
        <group
          name="Cube117_muro_0018"
          position={[-86.09, 79.923, -97.42]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[109.552, 123.675, 155.915]}
        >
          <mesh
            name="Cube117_muro_0018_1"
            geometry={nodes.Cube117_muro_0018_1.geometry}
            material={materials.TT_checker_1024x1024_UV_GRID}
          />
          <mesh
            name="Cube117_muro_0018_2"
            geometry={nodes.Cube117_muro_0018_2.geometry}
            material={materials['ARCADE.002']}
          />
          <mesh
            name="Cube117_muro_0018_3"
            geometry={nodes.Cube117_muro_0018_3.geometry}
            material={materials.PaletteMaterial002}
          />
          <mesh
            name="Cube117_muro_0018_4"
            geometry={nodes.Cube117_muro_0018_4.geometry}
            material={materials.PaletteMaterial003}
          />
          <mesh
            name="Cube117_muro_0018_5"
            geometry={nodes.Cube117_muro_0018_5.geometry}
            material={materials['PaletteMaterial001.001']}
          />
          <mesh
            name="Cube117_muro_0018_6"
            geometry={nodes.Cube117_muro_0018_6.geometry}
            material={materials['PaletteMaterial002.001']}
          />
          <mesh
            name="Cube117_muro_0018_7"
            geometry={nodes.Cube117_muro_0018_7.geometry}
            material={materials.PaletteMaterial003}
          />
          <mesh
            name="Cube117_muro_0018_8"
            geometry={nodes.Cube117_muro_0018_8.geometry}
            material={materials.Stick}
          />
          <mesh
            name="Cube117_muro_0018_9"
            geometry={nodes.Cube117_muro_0018_9.geometry}
            material={materials.GameBoy}
          />
          <mesh
            name="Cube117_muro_0018_10"
            geometry={nodes.Cube117_muro_0018_10.geometry}
            material={materials.lowpoly}
          />
          <mesh
            name="Cube117_muro_0018_11"
            geometry={nodes.Cube117_muro_0018_11.geometry}
            material={materials['GamepadStuff.001']}
          />
          <mesh
            name="Cube117_muro_0018_12"
            geometry={nodes.Cube117_muro_0018_12.geometry}
            material={materials['gamepadMain.001']}
          />
          <mesh
            name="Cube117_muro_0018_13"
            geometry={nodes.Cube117_muro_0018_13.geometry}
            material={materials['Sticker_SPC-SG']}
          />
          <mesh
            name="Cube117_muro_0018_14"
            geometry={nodes.Cube117_muro_0018_14.geometry}
            material={materials.baked}
          />
          <mesh
            name="Cube117_muro_0018_15"
            geometry={nodes.Cube117_muro_0018_15.geometry}
            material={materials.RubixCube}
          />
          <mesh
            name="Cube117_muro_0018_16"
            geometry={nodes.Cube117_muro_0018_16.geometry}
            material={materials.PaletteMaterial005}
          />
          <mesh
            name="Cube117_muro_0018_17"
            geometry={nodes.Cube117_muro_0018_17.geometry}
            material={materials['TT_checker_1024x1024_UV_GRID.001']}
          />
          <mesh
            name="Cube117_muro_0018_18"
            geometry={nodes.Cube117_muro_0018_18.geometry}
            material={materials.PaletteMaterial006}
          />
          <mesh
            name="Cube117_muro_0018_19"
            geometry={nodes.Cube117_muro_0018_19.geometry}
            material={materials.controllerbody}
          />
          <mesh
            name="Cube117_muro_0018_20"
            geometry={nodes.Cube117_muro_0018_20.geometry}
            material={materials['material.002']}
          />
          <mesh
            name="Cube117_muro_0018_21"
            geometry={nodes.Cube117_muro_0018_21.geometry}
            material={materials.ANALOG}
          />
          <mesh
            name="Cube117_muro_0018_22"
            geometry={nodes.Cube117_muro_0018_22.geometry}
            material={materials.dpad}
          />
          <mesh
            name="Cube117_muro_0018_23"
            geometry={nodes.Cube117_muro_0018_23.geometry}
            material={materials.cstick}
          />
          <mesh
            name="Cube117_muro_0018_24"
            geometry={nodes.Cube117_muro_0018_24.geometry}
            material={materials.startbutton}
          />
          <mesh
            name="Cube117_muro_0018_25"
            geometry={nodes.Cube117_muro_0018_25.geometry}
            material={materials.abutton}
          />
          <mesh
            name="Cube117_muro_0018_26"
            geometry={nodes.Cube117_muro_0018_26.geometry}
            material={materials.zbutton}
          />
          <mesh
            name="Cube117_muro_0018_27"
            geometry={nodes.Cube117_muro_0018_27.geometry}
            material={materials.bumpers}
          />
          <mesh
            name="Cube117_muro_0018_28"
            geometry={nodes.Cube117_muro_0018_28.geometry}
            material={materials.bButton}
          />
          <mesh
            name="Cube117_muro_0018_29"
            geometry={nodes.Cube117_muro_0018_29.geometry}
            material={materials.PaletteMaterial002}
          />
          <mesh
            name="Cube117_muro_0018_30"
            geometry={nodes.Cube117_muro_0018_30.geometry}
            material={materials.Mtl2}
          />
          <mesh
            name="Cube117_muro_0018_31"
            geometry={nodes.Cube117_muro_0018_31.geometry}
            material={materials['material.003']}
          />
          <mesh
            name="Cube117_muro_0018_32"
            geometry={nodes.Cube117_muro_0018_32.geometry}
            material={materials.PaletteMaterial004}
          />
        </group>
        <mesh
          name="Object_76"
          geometry={nodes.Object_76.geometry}
          material={materials['blackFabric.001']}
          position={[13.871, 68.227, -98.518]}
          rotation={[0, 0.717, 0]}
          scale={[4.452, 4.129, 3.664]}
        />
        <mesh
          name="Object_78"
          geometry={nodes.Object_78.geometry}
          material={materials['blackInternal.001']}
          position={[13.871, 68.227, -98.518]}
          rotation={[0, 0.717, 0]}
          scale={[4.452, 4.129, 3.664]}
        />
      </group>
    </group>
  );
};

export default RachosRoom;

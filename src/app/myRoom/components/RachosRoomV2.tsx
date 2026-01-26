import { useAnimations, useGLTF } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFActions, GLTFResult } from './RachosRoomTypes';
export default function RachosRoom(props: JSX.IntrinsicElements['group']) {
  const group = useRef<THREE.Group>(null);

  // Use unknown as an intermediate cast
  const gltf = useGLTF(
    'https://racho-devs.s3.us-east-2.amazonaws.com/roomV2/desktop/RachosRoomDesktop.glb'
  ) as unknown as GLTFResult;
  const { nodes, materials, animations } = gltf;

  // Remove generic parameter and cast actions
  const { actions } = useAnimations(animations, group);
  const typedActions = actions as GLTFActions;
  useEffect(() => {
    // Function to play all animations simultaneously
    const playAllAnimations = () => {
      Object.values(typedActions).forEach((action) => {
        if (action) action.play();
      });
    };

    playAllAnimations();

    // Optionally, stop all animations when the component unmounts
    return () => {
      Object.values(typedActions).forEach((action) => {
        if (action) action.stop();
      });
    };
  }, [typedActions]);
  return (
    <group ref={group} {...props} dispose={null}>
      <group name="FinalMainScene">
        <group
          name="Mesh_39003"
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        />
        <group
          name="Speakers007"
          position={[-5.571, 0.065, 2.787]}
          rotation={[Math.PI, -0.775, Math.PI]}
          scale={0.231}
        >
          <group
            name="Circle003_13010"
            position={[0.991, 0.599, 0]}
            rotation={[0, 0, Math.PI / 2]}
          />
          <group
            name="Circle005_16010"
            position={[0.992, 2, -4.398]}
            rotation={[0, 0, Math.PI / 2]}
          />
          <group
            name="Circle007_18010"
            position={[0.992, 0.598, -4.398]}
            rotation={[0, 0, Math.PI / 2]}
          />
          <group
            name="Circle009_4010"
            position={[0.891, 0.305, -2.9]}
            rotation={[0, 0, Math.PI / 2]}
            scale={0.822}
          />
          <group
            name="Circle011_1010"
            position={[0.892, 0.304, -1.5]}
            rotation={[0, 0, Math.PI / 2]}
            scale={0.822}
          />
          <group
            name="Circle013_7010"
            position={[0.891, 1.359, -2.199]}
            rotation={[0, 0, Math.PI / 2]}
            scale={0.822}
          />
          <group
            name="Speakers008"
            position={[0.991, 1.999, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <group
              name="Speakers009"
              position={[1.639, 1.633, -2.21]}
              scale={3.628}
            >
              <group
                name="Mesh_0003"
                position={[-5.999, -1, -3.995]}
                scale={0.001}
              >
                <mesh
                  name="Mesh_0002"
                  geometry={nodes.Mesh_0002.geometry}
                  material={materials['PaletteMaterial001.100']}
                />
                <mesh
                  name="Mesh_0002_1"
                  geometry={nodes.Mesh_0002_1.geometry}
                  material={materials['blackInternal.011']}
                />
                <mesh
                  name="Mesh_0002_2"
                  geometry={nodes.Mesh_0002_2.geometry}
                  material={materials['frontColor.010']}
                />
                <mesh
                  name="Mesh_0002_3"
                  geometry={nodes.Mesh_0002_3.geometry}
                  material={materials['PaletteMaterial003.037']}
                />
                <mesh
                  name="Mesh_0002_4"
                  geometry={nodes.Mesh_0002_4.geometry}
                  material={materials['blackFabric.011']}
                />
                <mesh
                  name="Mesh_0002_5"
                  geometry={nodes.Mesh_0002_5.geometry}
                  material={materials['PaletteMaterial004.030']}
                />
              </group>
            </group>
          </group>
        </group>
        <group
          name="SpeakersLights"
          position={[-4.978, 0.104, 2.887]}
          rotation={[0, -0.824, 0]}
          scale={[0.227, 0.21, 0.187]}
        >
          <group name="equalizer_35010">
            <group
              name="baseCover001_0010"
              position={[0, 1.797, 0]}
              rotation={[-Math.PI, -0.122, 0]}
              scale={[1.023, 1.804, 1.023]}
            >
              <group name="Object_5008" position={[0, -0.144, 0]} scale={1.144}>
                <mesh
                  name="Mesh_1003"
                  geometry={nodes.Mesh_1003.geometry}
                  material={materials['PaletteMaterial003.037']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator10_3010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.321, 1]}
            >
              <group name="Object_11015" position={[0.869, -0.999, 0.464]}>
                <mesh
                  name="Mesh_2003"
                  geometry={nodes.Mesh_2003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator11_4010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.542, 1]}
            >
              <group name="Object_13010" position={[0.761, -0.999, 0.625]}>
                <mesh
                  name="Mesh_3003"
                  geometry={nodes.Mesh_3003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator12_5010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.125, 1]}
            >
              <group name="Object_15013" position={[0.625, -0.999, 0.762]}>
                <mesh
                  name="Mesh_4003"
                  geometry={nodes.Mesh_4003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator13_6010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.791, 1]}
            >
              <group name="Object_17012" position={[0.464, -0.999, 0.869]}>
                <mesh
                  name="Mesh_5003"
                  geometry={nodes.Mesh_5003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator14_7010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.436, 1]}
            >
              <group name="Object_19008" position={[0.286, -0.999, 0.943]}>
                <mesh
                  name="Mesh_6003"
                  geometry={nodes.Mesh_6003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator15_8010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.197, 1]}
            >
              <group name="Object_21008" position={[0.096, -0.999, 0.98]}>
                <mesh
                  name="Mesh_7003"
                  geometry={nodes.Mesh_7003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator16_9010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.412, 1]}
            >
              <group name="Object_23008" position={[-0.097, -0.999, 0.98]}>
                <mesh
                  name="Mesh_8003"
                  geometry={nodes.Mesh_8003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator17_10010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.351, 1]}
            >
              <group name="Object_25008" position={[-0.286, -0.999, 0.943]}>
                <mesh
                  name="Mesh_9003"
                  geometry={nodes.Mesh_9003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator18_11010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.619, 1]}
            >
              <group name="Object_27008" position={[-0.625, -0.999, 0.762]}>
                <mesh
                  name="Mesh_10003"
                  geometry={nodes.Mesh_10003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator19_12010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.953, 1]}
            >
              <group name="Object_29008" position={[-0.762, -0.999, 0.625]}>
                <mesh
                  name="Mesh_11003"
                  geometry={nodes.Mesh_11003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator1_2010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.291, 1]}
            >
              <group name="Object_9006" position={[0.286, -0.999, -0.943]}>
                <mesh
                  name="Mesh_12003"
                  geometry={nodes.Mesh_12003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator20_14010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.551, 1]}
            >
              <group name="Object_33008" position={[-0.869, -0.999, 0.464]}>
                <mesh
                  name="Mesh_13003"
                  geometry={nodes.Mesh_13003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator21_15010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.544, 1]}
            >
              <group name="Object_35005" position={[-0.943, -0.999, 0.286]}>
                <mesh
                  name="Mesh_14003"
                  geometry={nodes.Mesh_14003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator22_16010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.713, 1]}
            >
              <group name="Object_37006" position={[-0.981, -0.999, 0.096]}>
                <mesh
                  name="Mesh_15003"
                  geometry={nodes.Mesh_15003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator23_17010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.856, 1]}
            >
              <group name="Object_39008" position={[-0.981, -0.999, -0.097]}>
                <mesh
                  name="Mesh_16003"
                  geometry={nodes.Mesh_16003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator24_18010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.202, 1]}
            >
              <group name="Object_41005" position={[-0.943, -0.999, -0.286]}>
                <mesh
                  name="Mesh_17004"
                  geometry={nodes.Mesh_17004.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator25_19010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.129, 1]}
            >
              <group name="Object_43005" position={[-0.869, -0.999, -0.464]}>
                <mesh
                  name="Mesh_18003"
                  geometry={nodes.Mesh_18003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator26_20010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.826, 1]}
            >
              <group name="Object_45005" position={[-0.762, -0.999, -0.625]}>
                <mesh
                  name="Mesh_19003"
                  geometry={nodes.Mesh_19003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator27_21010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.374, 1]}
            >
              <group name="Object_47005" position={[-0.625, -0.999, -0.762]}>
                <mesh
                  name="Mesh_20003"
                  geometry={nodes.Mesh_20003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator28_22010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.847, 1]}
            >
              <group name="Object_49005" position={[-0.465, -0.999, -0.869]}>
                <mesh
                  name="Mesh_21003"
                  geometry={nodes.Mesh_21003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator29_23010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.037, 1]}
            >
              <group name="Object_51005" position={[-0.286, -0.999, -0.943]}>
                <mesh
                  name="Mesh_22003"
                  geometry={nodes.Mesh_22003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator2_13010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.453, 1]}
            >
              <group name="Object_31008" position={[0.464, -0.999, -0.869]}>
                <mesh
                  name="Mesh_23003"
                  geometry={nodes.Mesh_23003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator30_25010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.362, 1]}
            >
              <group name="Object_55005" position={[-0.097, -0.999, -0.98]}>
                <mesh
                  name="Mesh_24003"
                  geometry={nodes.Mesh_24003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator31_26010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.041, 1]}
            >
              <group name="Object_57005" position={[0.096, -0.999, -0.98]}>
                <mesh
                  name="Mesh_25003"
                  geometry={nodes.Mesh_25003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator32_27010"
              position={[0, 0.01, 0]}
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.925, 1]}
            >
              <group name="Object_59005" position={[-0.465, -0.999, 0.869]}>
                <mesh
                  name="Mesh_26003"
                  geometry={nodes.Mesh_26003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator3_24010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.797, 1]}
            >
              <group name="Object_53005" position={[0.625, -0.999, -0.762]}>
                <mesh
                  name="Mesh_27003"
                  geometry={nodes.Mesh_27003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator4_28010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.715, 1]}
            >
              <group name="Object_61005" position={[0.761, -0.999, -0.625]}>
                <mesh
                  name="Mesh_28003"
                  geometry={nodes.Mesh_28003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator5_29010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.567, 1]}
            >
              <group name="Object_63005" position={[0.869, -0.999, -0.464]}>
                <mesh
                  name="Mesh_29003"
                  geometry={nodes.Mesh_29003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator6_30010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.031, 1]}
            >
              <group name="Object_65005" position={[0.943, -0.999, -0.286]}>
                <mesh
                  name="Mesh_30003"
                  geometry={nodes.Mesh_30003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator7_31010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 1.771, 1]}
            >
              <group name="Object_67005" position={[0.98, -0.999, -0.097]}>
                <mesh
                  name="Mesh_31003"
                  geometry={nodes.Mesh_31003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator8_32010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.591, 1]}
            >
              <group name="Object_69005" position={[0.98, -0.999, 0.096]}>
                <mesh
                  name="Mesh_32003"
                  geometry={nodes.Mesh_32003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="indicator9_33010"
              rotation={[-Math.PI, 0, 0]}
              scale={[1, 0.524, 1]}
            >
              <group name="Object_71005" position={[0.943, -0.999, 0.286]}>
                <mesh
                  name="Mesh_33003"
                  geometry={nodes.Mesh_33003.geometry}
                  material={materials['equalizer.010']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="linees_34010"
              rotation={[-Math.PI, 0, 0]}
              scale={[0.99, 1.8, 0.99]}
            >
              <group name="Object_73005" position={[0, -1, 0]}>
                <mesh
                  name="Mesh_34003"
                  geometry={nodes.Mesh_34003.geometry}
                  material={materials['PaletteMaterial001.100']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
              <group name="Object_74004" position={[0, -1, 0]} scale={0.991}>
                <mesh
                  name="Mesh_35002"
                  geometry={nodes.Mesh_35002.geometry}
                  material={materials['Material.067']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
          </group>
        </group>
        <group
          name="GLTF_created_0001"
          position={[5.089, 0.204, -2.233]}
          scale={[0.065, 0.044, 0.065]}
        >
          <group name="GLTF_created_0_rootJoint001">
            <group name="Bone_36002">
              <group
                name="Bone001_1002"
                position={[0.096, -0.001, 0.032]}
                rotation={[0, -0.013, -1.587]}
              >
                <group
                  name="Bone002_0002"
                  position={[-0.105, 0.588, 0.304]}
                  rotation={[0.452, 0.03, 0.189]}
                />
              </group>
              <group
                name="Bone003_3002"
                position={[-0.118, -0.013, 0.015]}
                rotation={[-3.129, 0.001, 1.638]}
              >
                <group
                  name="Bone004_2002"
                  position={[0.061, 0.634, -0.318]}
                  rotation={[-0.512, -0.099, -0.199]}
                />
              </group>
              <group
                name="Bone005_5002"
                position={[0.096, -0.001, 0.85]}
                rotation={[0, -0.013, -1.587]}
              >
                <group
                  name="Bone006_4002"
                  position={[-0.06, 0.571, 0.34]}
                  rotation={[0.509, 0.056, 0.203]}
                />
              </group>
              <group
                name="Bone007_7002"
                position={[-0.118, -0.013, 0.833]}
                rotation={[-3.129, 0.001, 1.638]}
              >
                <group
                  name="Bone008_6002"
                  position={[0.11, 0.58, -0.397]}
                  rotation={[-0.644, -0.038, -0.264]}
                />
              </group>
              <group
                name="Bone009_9002"
                position={[0.366, -0.019, 1.434]}
                rotation={[0.006, -0.39, -1.526]}
              >
                <group
                  name="Bone010_8002"
                  position={[0.077, 0.842, -0.005]}
                  rotation={[0.469, -0.016, -0.066]}
                />
              </group>
              <group
                name="Bone011_11002"
                position={[-0.186, 0.06, 1.451]}
                rotation={[-3.134, -0.391, 1.443]}
              >
                <group
                  name="Bone012_10002"
                  position={[0.072, 0.753, -0.001]}
                  rotation={[-0.114, -0.12, 0.174]}
                />
              </group>
              <group
                name="Bone013_21002"
                position={[0.096, -0.001, -0.808]}
                rotation={[0, -0.013, -1.587]}
              >
                <group
                  name="Bone014_16002"
                  position={[-0.107, 0.622, 0.225]}
                  rotation={[0.32, 0.031, 0.192]}
                >
                  <group
                    name="Bone021_15002"
                    position={[0.451, 0.342, -0.818]}
                    rotation={[-2.173, 0.314, 0.199]}
                  >
                    <group
                      name="Bone022_14002"
                      position={[-0.987, -0.691, -0.156]}
                      rotation={[1.046, -0.448, 0.292]}
                    >
                      <group
                        name="Bone023_13002"
                        position={[0.413, 0.005, -2.588]}
                        rotation={[-1.826, 0.699, 2.049]}
                      >
                        <group
                          name="Bone024_12002"
                          position={[-1.698, 1.674, -1.72]}
                          rotation={[2.273, -0.395, -1.644]}
                        />
                      </group>
                    </group>
                  </group>
                </group>
                <group
                  name="Bone025_20002"
                  position={[0, 0.67, 0]}
                  rotation={[-1.555, -0.169, 0.172]}
                >
                  <group
                    name="Bone026_19002"
                    position={[0.074, 0.542, -0.267]}
                    rotation={[-0.501, 0.04, -0.358]}
                  >
                    <group
                      name="Bone027_18002"
                      position={[-0.035, 0.174, 0.891]}
                      rotation={[0.858, 0.254, 1.586]}
                    >
                      <group
                        name="Bone028_17002"
                        position={[-0.929, -0.424, -1.265]}
                        rotation={[0.109, 1.131, 0.17]}
                      />
                    </group>
                  </group>
                </group>
              </group>
              <group
                name="Bone015_31002"
                position={[-0.118, -0.013, -0.825]}
                rotation={[-3.129, 0.001, 1.638]}
              >
                <group
                  name="Bone016_26002"
                  position={[0.181, 0.63, -0.277]}
                  rotation={[-0.466, -0.047, -0.368]}
                >
                  <group
                    name="Bone017_25002"
                    position={[-0.641, -0.11, 1.059]}
                    rotation={[2.718, 0.538, -0.444]}
                  >
                    <group
                      name="Bone018_24002"
                      position={[1.206, -0.854, 1.483]}
                      rotation={[-2.444, -0.517, -1.303]}
                    >
                      <group
                        name="Bone019_23002"
                        position={[1.551, -1.121, 1.662]}
                        rotation={[-2.616, -0.371, 0.669]}
                      >
                        <group
                          name="Bone020_22002"
                          position={[0.606, 0.131, 1.236]}
                          rotation={[0.177, -1.086, 1.975]}
                        />
                      </group>
                    </group>
                  </group>
                </group>
                <group
                  name="Bone029_30002"
                  position={[0, 0.712, 0]}
                  rotation={[1.651, 0.042, 0.039]}
                >
                  <group
                    name="Bone030_29002"
                    position={[-0.049, 0.657, 0.036]}
                    rotation={[-0.117, -0.007, -0.024]}
                  >
                    <group
                      name="Bone031_28002"
                      position={[0.034, 0.457, 0.111]}
                      rotation={[0.534, -0.209, 1.177]}
                    >
                      <group
                        name="Bone032_27002"
                        position={[-0.085, 0.098, -0.289]}
                        rotation={[0.081, 0.057, -0.241]}
                      />
                    </group>
                  </group>
                </group>
              </group>
              <group
                name="Bone034_35002"
                position={[-0.043, 0.036, -0.789]}
                rotation={[1.391, 1.169, -2.906]}
              >
                <group
                  name="Bone035_34002"
                  position={[0.134, 0.691, -0.196]}
                  rotation={[-0.429, 0.062, -0.277]}
                >
                  <group
                    name="Bone036_33002"
                    position={[-0.475, 0.016, 0.523]}
                    rotation={[0.335, -0.161, 1.645]}
                  >
                    <group
                      name="Bone037_32002"
                      position={[-0.041, -0.568, -1.154]}
                      rotation={[-0.459, 1.176, 1.401]}
                    />
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
        <group
          name="MeBitEnderman002"
          position={[3.273, 0.313, -3.028]}
          rotation={[-0.425, -0.011, -0.088]}
          scale={[0, 0.001, 0.002]}
        >
          <group
            name="Armature008"
            position={[0, 0, -0.001]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={100}
          >
            <group
              name="Object_11016"
              position={[0, 0, -0.756]}
              rotation={[0.068, 0.001, 0.012]}
              scale={[1.935, 0.349, 0.932]}
            >
              <primitive object={nodes._rootJoint} />
              <primitive object={nodes.neutral_bone} />
              <group name="Object_14007" />
              <group name="Object_15014" />
              <group name="Mesh_37003">
                <skinnedMesh
                  name="Mesh_37002"
                  geometry={nodes.Mesh_37002.geometry}
                  material={materials['Skin.006']}
                  skeleton={nodes.Mesh_37002.skeleton}
                />
                <skinnedMesh
                  name="Mesh_37002_1"
                  geometry={nodes.Mesh_37002_1.geometry}
                  material={materials['PaletteMaterial001.101']}
                  skeleton={nodes.Mesh_37002_1.skeleton}
                />
              </group>
              <skinnedMesh
                name="Mesh_38004"
                geometry={nodes.Mesh_38004.geometry}
                material={materials['Eyes.006']}
                skeleton={nodes.Mesh_38004.skeleton}
              />
            </group>
          </group>
        </group>
        <group
          name="MeBitFatty005"
          position={[4.833, 0.654, -2.28]}
          rotation={[1.861, -0.003, -0.009]}
          scale={[1.02, 0.075, 0.766]}
        >
          <group
            name="MeBitFatty007"
            position={[0.533, 79.597, 1.172]}
            scale={[0.043, 0.578, 0.057]}
          />
        </group>
        <group
          name="MeBitRobot002"
          position={[3.084, 0.506, 0.16]}
          rotation={[-Math.PI, 1.566, -Math.PI]}
          scale={[0.006, 0.006, 0.007]}
        >
          <group
            name="Robot_OriginMeBitRobot003"
            position={[0, 0.615, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={100}
          >
            <group name="Ears007" position={[0, 0, 2.949]} />
            <group name="Empty007" position={[0, -0.06, 2.786]}>
              <group
                name="Eyes007"
                position={[0, -0.431, 0.076]}
                scale={[1, 1, 0]}
              />
            </group>
            <group name="Hand_origin013" position={[0.723, 0, 2.015]}>
              <group name="hANDS007" position={[-0.723, 0, -1.963]}>
                <group
                  name="hANDS_White_Glossy_0003"
                  position={[0.894, -0.002, 1.418]}
                  scale={0.491}
                >
                  <mesh
                    name="Mesh_40005"
                    geometry={nodes.Mesh_40005.geometry}
                    material={materials['PaletteMaterial001.102']}
                    position={[-5.999, -1, -3.995]}
                    scale={0.001}
                  />
                </group>
              </group>
            </group>
            <group
              name="Hand_origin014"
              position={[-0.723, 0, 2.015]}
              rotation={[0, 0, -Math.PI]}
            >
              <group name="hANDS008" position={[-0.723, 0, -1.963]}>
                <group
                  name="hANDS002_White_Glossy_0003"
                  position={[0.894, -0.002, 1.418]}
                  scale={0.491}
                >
                  <mesh
                    name="Mesh_40006"
                    geometry={nodes.Mesh_40006.geometry}
                    material={materials['PaletteMaterial001.102']}
                    position={[-5.999, -1, -3.995]}
                    scale={0.001}
                  />
                </group>
              </group>
            </group>
            <group name="Mouth007" position={[0, -0.504, 2.573]} />
            <group name="Wave025" position={[0, 0, 1]}>
              <group
                name="Wave_Blue_Light_0004"
                position={[0.001, -0.002, -0.002]}
                scale={0.506}
              >
                <mesh
                  name="Mesh_43009"
                  geometry={nodes.Mesh_43009.geometry}
                  material={materials['PaletteMaterial002.054']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="Wave026"
              position={[0, 0, 0.427]}
              scale={[1, 1, 0.474]}
            >
              <group
                name="Wave002_Blue_Light_0004"
                position={[0.001, -0.002, -0.002]}
                scale={0.506}
              >
                <mesh
                  name="Mesh_43010"
                  geometry={nodes.Mesh_43010.geometry}
                  material={materials['PaletteMaterial002.054']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group
              name="Wave027"
              position={[0, 0, 0.819]}
              scale={[1, 1, 0.834]}
            >
              <group
                name="Wave001_Blue_Light_0004"
                position={[0.001, -0.002, -0.002]}
                scale={0.506}
              >
                <mesh
                  name="Mesh_43011"
                  geometry={nodes.Mesh_43011.geometry}
                  material={materials['PaletteMaterial002.054']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group name="Wave028" position={[0, 0, 0.05]} scale={[1, 1, 0.128]}>
              <group
                name="Wave003_Blue_Light_0004"
                position={[0.001, -0.002, -0.002]}
                scale={0.506}
              >
                <mesh
                  name="Mesh_43012"
                  geometry={nodes.Mesh_43012.geometry}
                  material={materials['PaletteMaterial002.054']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
            </group>
            <group name="Robot004" position={[0, 0, 0.051]}>
              <group
                name="Robot_Blue_Light_0004"
                position={[0.001, -0.132, 1.329]}
                scale={0.778}
              >
                <mesh
                  name="Mesh_41006"
                  geometry={nodes.Mesh_41006.geometry}
                  material={materials['PaletteMaterial002.054']}
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                />
              </group>
              <group
                name="Robot_White_Glossy_0004"
                position={[0.069, 0.004, 3.25]}
                scale={2.845}
              >
                <group
                  name="Mesh_42003"
                  position={[-5.999, -1, -3.995]}
                  scale={0.001}
                >
                  <mesh
                    name="Mesh_42002"
                    geometry={nodes.Mesh_42002.geometry}
                    material={materials['PaletteMaterial001.103']}
                  />
                  <mesh
                    name="Mesh_42002_1"
                    geometry={nodes.Mesh_42002_1.geometry}
                    material={materials['Glass.012']}
                  />
                  <mesh
                    name="Mesh_42002_2"
                    geometry={nodes.Mesh_42002_2.geometry}
                    material={materials['PaletteMaterial001.102']}
                  />
                  <mesh
                    name="Mesh_42002_3"
                    geometry={nodes.Mesh_42002_3.geometry}
                    material={materials['PaletteMaterial003.038']}
                  />
                  <mesh
                    name="Mesh_42002_4"
                    geometry={nodes.Mesh_42002_4.geometry}
                    material={materials['PaletteMaterial004.031']}
                  />
                  <mesh
                    name="Mesh_42002_5"
                    geometry={nodes.Mesh_42002_5.geometry}
                    material={materials['PaletteMaterial005.039']}
                  />
                </group>
              </group>
            </group>
          </group>
        </group>
        <group name="Couch1001" position={[-5.999, -1, -3.995]} scale={0.001} />
        <group
          name="Armature009"
          position={[-49.33, -51.924, 49.897]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={20}
        >
          <group name="Object_5009">
            <group name="_rootJoint007">
              <group
                name="Bone001_02002"
                position={[-2.552, 7.511, 7.537]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <group name="Bone001_end_030002" position={[0, 1, 0]} />
              </group>
              <group
                name="Bone002_03002"
                position={[7.457, 7.511, 7.537]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <group name="Bone002_end_029002" position={[0, 1, 0]} />
              </group>
              <group
                name="Bone003_04002"
                position={[7.457, -2.534, 7.537]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <group name="Bone003_end_017002" position={[0, 1, 0]} />
              </group>
              <group
                name="Bone004_05002"
                position={[-2.552, -2.534, 7.537]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <group name="Bone004_end_021002" position={[0, 1, 0]} />
              </group>
              <group
                name="Bone005_06002"
                position={[-2.552, -2.534, -2.466]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <group name="Bone005_end_024002" position={[0, 1, 0]} />
              </group>
              <group
                name="Bone006_07002"
                position={[7.457, -2.534, -2.466]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <group name="Bone006_end_026002" position={[0, 1, 0]} />
              </group>
              <group
                name="Bone007_08002"
                position={[7.457, 7.511, -2.466]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <group name="Bone007_end_022002" position={[0, 1, 0]} />
              </group>
              <group
                name="Bone008_09005"
                position={[-2.552, 7.511, -2.466]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <group name="Bone008_end_027002" position={[0, 1, 0]} />
              </group>
              <group
                name="Bone009_010002"
                position={[0, 4.941, 0]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <group name="Bone009_end_019002" position={[0, 1, 0]} />
              </group>
              <group
                name="Bone010_011002"
                position={[4.977, 4.941, 0]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <group name="Bone010_end_028002" position={[0, 1, 0]} />
              </group>
              <group
                name="Bone011_012002"
                position={[4.977, 0, 0]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <group name="Bone011_end_031002" position={[0, 1, 0]} />
              </group>
              <group
                name="Bone012_013002"
                position={[0, 0, 5.128]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <group name="Bone012_end_00002" position={[0, 1, 0]} />
              </group>
              <group
                name="Bone013_014002"
                position={[4.977, 0, 5.128]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <group name="Bone013_end_025002" position={[0, 1, 0]} />
              </group>
              <group
                name="Bone014_015005"
                position={[4.977, 4.941, 5.128]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <group name="Bone014_end_023002" position={[0, 1, 0]} />
              </group>
              <group
                name="Bone015_016005"
                position={[0, 4.941, 5.128]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <group name="Bone015_end_018002" position={[0, 1, 0]} />
              </group>
              <group name="Bone_01002" rotation={[Math.PI / 2, 0, 0]}>
                <group name="Bone_end_020002" position={[0, 1, 0]} />
              </group>
            </group>
          </group>
        </group>
        <group
          name="RootNode005"
          position={[-0.416, 7.023, 0.278]}
          scale={[0.555, 0.515, 0.55]}
        >
          <group name="circle009">
            <mesh
              name="circle_constant1_0002"
              geometry={nodes.circle_constant1_0002.geometry}
              material={materials['constant1.001']}
            />
            <mesh
              name="circle_HoloFillDark_0002"
              geometry={nodes.circle_HoloFillDark_0002.geometry}
              material={materials['HoloFillDark.001']}
            />
          </group>
          <group name="circle1002">
            <mesh
              name="circle1_constant2_0002"
              geometry={nodes.circle1_constant2_0002.geometry}
              material={materials['constant2.001']}
            />
          </group>
          <group name="circle2009">
            <mesh
              name="circle2_constant2_0002"
              geometry={nodes.circle2_constant2_0002.geometry}
              material={materials['constant2.001']}
            />
          </group>
          <group name="geo1002">
            <mesh
              name="geo1_constant1_0002"
              geometry={nodes.geo1_constant1_0002.geometry}
              material={materials['constant1.001']}
            />
          </group>
        </group>
        <group
          name="MeBitSanta021"
          position={[-5.306, 4.452, -3.343]}
          rotation={[-1.589, -0.004, -1.468]}
          scale={[0.004, 0.005, 0.008]}
        >
          <primitive object={nodes._rootJoint_1} />
          <group name="Object_87004" position={[-17.364, 1.346, -4.95]} />
          <group name="Object_88004" position={[-17.364, 1.346, -4.95]} />
          <skinnedMesh
            name="MeBitSanta034"
            geometry={nodes.MeBitSanta034.geometry}
            material={materials['CH_NPC_Pig_MI_PJH.006']}
            skeleton={nodes.MeBitSanta034.skeleton}
          />
          <skinnedMesh
            name="Mesh_47003"
            geometry={nodes.Mesh_47003.geometry}
            material={materials['CH_NPC_Pig_Eyelash_PJH.007']}
            skeleton={nodes.Mesh_47003.skeleton}
          />
        </group>
        <group
          name="MeBitSanta022"
          position={[-5.317, 4.455, -3.195]}
          rotation={[-1.589, -0.004, -1.468]}
          scale={[0.004, 0.005, 0.008]}
        >
          <primitive object={nodes._rootJoint_2} />
          <group name="Object_229004" position={[-17.364, 1.346, -4.95]} />
          <group name="Object_230004" position={[-17.364, 1.346, -4.95]} />
          <skinnedMesh
            name="MeBitSanta031"
            geometry={nodes.MeBitSanta031.geometry}
            material={materials['CH_NPC_Pig_MI_PJH.006']}
            skeleton={nodes.MeBitSanta031.skeleton}
          />
          <skinnedMesh
            name="Mesh_49003"
            geometry={nodes.Mesh_49003.geometry}
            material={materials['CH_NPC_Pig_Eyelash_PJH.007']}
            skeleton={nodes.Mesh_49003.skeleton}
          />
        </group>
        <group
          name="MeBitSanta023"
          position={[-5.199, 4.453, -3.34]}
          rotation={[-1.589, -0.004, -1.468]}
          scale={[0.004, 0.005, 0.008]}
        >
          <primitive object={nodes._rootJoint_3} />
          <group name="Object_16007" position={[-17.364, 1.346, -4.949]} />
          <group name="Object_17013" position={[-17.364, 1.346, -4.949]} />
          <skinnedMesh
            name="MeBitSanta033"
            geometry={nodes.MeBitSanta033.geometry}
            material={materials['CH_NPC_Pig_MI_PJH.006']}
            skeleton={nodes.MeBitSanta033.skeleton}
          />
          <skinnedMesh
            name="Mesh_51003"
            geometry={nodes.Mesh_51003.geometry}
            material={materials['CH_NPC_Pig_Eyelash_PJH.007']}
            skeleton={nodes.Mesh_51003.skeleton}
          />
        </group>
        <group
          name="MeBitSanta024"
          position={[-5.21, 4.455, -3.193]}
          rotation={[-1.589, -0.004, -1.468]}
          scale={[0.004, 0.005, 0.008]}
        >
          <primitive object={nodes._rootJoint_4} />
          <group name="Object_158004" position={[-17.364, 1.346, -4.949]} />
          <group name="Object_159004" position={[-17.364, 1.346, -4.949]} />
          <skinnedMesh
            name="MeBitSanta032"
            geometry={nodes.MeBitSanta032.geometry}
            material={materials['CH_NPC_Pig_MI_PJH.006']}
            skeleton={nodes.MeBitSanta032.skeleton}
          />
          <skinnedMesh
            name="Mesh_53003"
            geometry={nodes.Mesh_53003.geometry}
            material={materials['CH_NPC_Pig_Eyelash_PJH.007']}
            skeleton={nodes.Mesh_53003.skeleton}
          />
        </group>
        <group
          name="MeBitSanta025"
          position={[-5.225, 4.427, -3.461]}
          rotation={[0.021, -1.468, 0.039]}
          scale={[0.004, 0.008, 0.005]}
        >
          <group
            name="Polygon_Reduction_1006"
            position={[-41.898, 18.25, -1.214]}
            rotation={[-0.004, -0.106, -0.015]}
          >
            <group
              name="Polygon_Reduction_1_Material_0_0004"
              position={[1.115, 13.84, -1.726]}
              scale={37.887}
            >
              <group
                name="MeBitSanta"
                position={[-5.999, -1, -3.995]}
                scale={0.001}
              >
                <mesh
                  name="Mesh_54002"
                  geometry={nodes.Mesh_54002.geometry}
                  material={materials['MeditationSanta_Model_9_u1_v1.006']}
                />
                <mesh
                  name="Mesh_54002_1"
                  geometry={nodes.Mesh_54002_1.geometry}
                  material={materials['PaletteMaterial001.103']}
                />
                <mesh
                  name="Mesh_54002_2"
                  geometry={nodes.Mesh_54002_2.geometry}
                  material={materials['material_0.014']}
                />
                <mesh
                  name="Mesh_54002_3"
                  geometry={nodes.Mesh_54002_3.geometry}
                  material={materials['Material_0.006']}
                />
                <mesh
                  name="Mesh_54002_4"
                  geometry={nodes.Mesh_54002_4.geometry}
                  material={materials['PaletteMaterial001.120']}
                />
              </group>
            </group>
          </group>
        </group>
        <group
          name="MeBitSanta026"
          position={[-5.387, 4.885, -3.699]}
          rotation={[0, -0.011, 0]}
          scale={[0.01, 0.008, 0.008]}
        >
          <group
            name="Cylinder001_3006"
            position={[0, 4.829, -0.021]}
            scale={0.862}
          >
            <group name="Object_11017" position={[0, 0.318, 0]} scale={0.456}>
              <mesh
                name="Mesh_56003"
                geometry={nodes.Mesh_56003.geometry}
                material={materials['Material.066']}
                position={[-5.999, -1, -3.996]}
                scale={0.001}
              />
            </group>
          </group>
          <group name="Cylinder002_4006">
            <group
              name="Object_13011"
              position={[-0.024, 0.833, 0.034]}
              scale={0.461}
            >
              <mesh
                name="Mesh_57003"
                geometry={nodes.Mesh_57003.geometry}
                material={materials['Material.066']}
                position={[-5.999, -1, -3.995]}
                scale={0.001}
              />
            </group>
          </group>
          <group
            name="Plane001_6006"
            position={[-1.634, 3.713, -0.274]}
            rotation={[Math.PI / 2, -Math.PI / 4, 0]}
            scale={0.16}
          >
            <group name="Object_17014" position={[0, 0, 0.001]} scale={1.057}>
              <mesh
                name="Mesh_58003"
                geometry={nodes.Mesh_58003.geometry}
                material={materials['Material.066']}
                position={[-5.999, -1, -3.996]}
                scale={0.001}
              />
            </group>
          </group>
          <group
            name="Plane002_7006"
            position={[1.389, 4.408, -0.274]}
            rotation={[Math.PI / 2, -Math.PI / 4, 0]}
            scale={0.163}
          >
            <group name="Object_19009" position={[-0.001, 0, 0]} scale={1.057}>
              <mesh
                name="Mesh_59003"
                geometry={nodes.Mesh_59003.geometry}
                material={materials['Material.066']}
                position={[-5.999, -1, -3.995]}
                scale={0.001}
              />
            </group>
          </group>
          <group
            name="Plane003_8006"
            position={[-1.828, 1.67, -0.274]}
            rotation={[Math.PI / 2, -Math.PI / 4, 0]}
            scale={0.118}
          >
            <group
              name="Object_21009"
              position={[0, -0.001, -0.001]}
              scale={1.057}
            >
              <mesh
                name="Mesh_60003"
                geometry={nodes.Mesh_60003.geometry}
                material={materials['Material.066']}
                position={[-5.999, -0.999, -3.994]}
                scale={0.001}
              />
            </group>
          </group>
          <group
            name="Plane004_9006"
            position={[-0.742, 4.681, -0.274]}
            rotation={[Math.PI / 2, -Math.PI / 4, 0]}
            scale={0.127}
          >
            <group
              name="Object_23009"
              position={[-0.002, 0, -0.001]}
              scale={1.057}
            >
              <mesh
                name="Mesh_61003"
                geometry={nodes.Mesh_61003.geometry}
                material={materials['Material.066']}
                position={[-5.998, -1, -3.995]}
                scale={0.001}
              />
            </group>
          </group>
          <group
            name="Plane005_10006"
            position={[3.055, 2.912, -0.274]}
            rotation={[Math.PI / 2, -Math.PI / 4, 0]}
            scale={0.105}
          >
            <group name="Object_25009" position={[0.001, 0, 0]} scale={1.057}>
              <mesh
                name="Mesh_62003"
                geometry={nodes.Mesh_62003.geometry}
                material={materials['Material.066']}
                position={[-6, -1, -3.997]}
                scale={0.001}
              />
            </group>
          </group>
          <group
            name="Plane006_11006"
            position={[-2.211, 0.886, -0.274]}
            rotation={[Math.PI / 2, -Math.PI / 4, 0]}
            scale={0.147}
          >
            <group name="Object_27009" position={[0.001, 0, 0]} scale={1.057}>
              <mesh
                name="Mesh_63003"
                geometry={nodes.Mesh_63003.geometry}
                material={materials['Material.066']}
                position={[-5.999, -1, -3.996]}
                scale={0.001}
              />
            </group>
          </group>
          <group
            name="Plane007_12006"
            position={[-1.959, 3.019, -0.274]}
            rotation={[Math.PI / 2, -Math.PI / 4, 0]}
            scale={0.163}
          >
            <group name="Object_29009" position={[0.001, 0, 0]} scale={1.057}>
              <mesh
                name="Mesh_64003"
                geometry={nodes.Mesh_64003.geometry}
                material={materials['Material.066']}
                position={[-6, -1, -3.995]}
                scale={0.001}
              />
            </group>
          </group>
          <group
            name="Plane008_13006"
            position={[2.516, 1.124, -0.274]}
            rotation={[Math.PI / 2, -Math.PI / 4, 0]}
            scale={0.118}
          >
            <group
              name="Object_31009"
              position={[0.002, -0.001, 0]}
              scale={1.057}
            >
              <mesh
                name="Mesh_65003"
                geometry={nodes.Mesh_65003.geometry}
                material={materials['Material.066']}
                position={[-5.997, -1, -3.995]}
                scale={0.001}
              />
            </group>
          </group>
          <group
            name="Plane009_14006"
            position={[1.776, 3.347, -0.274]}
            rotation={[Math.PI / 2, -Math.PI / 4, 0]}
            scale={0.127}
          >
            <group name="Object_33009" position={[0, 0, 0]} scale={1.057}>
              <mesh
                name="Mesh_66003"
                geometry={nodes.Mesh_66003.geometry}
                material={materials['Material.066']}
                position={[-5.998, -0.999, -3.995]}
                scale={0.001}
              />
            </group>
          </group>
          <group
            name="Plane_5006"
            position={[1.654, 1.949, -0.274]}
            rotation={[Math.PI / 2, -Math.PI / 4, 0]}
            scale={0.147}
          >
            <group name="Object_15015" position={[0.002, 0, 0]} scale={1.057}>
              <mesh
                name="Mesh_67003"
                geometry={nodes.Mesh_67003.geometry}
                material={materials['Material.066']}
                position={[-5.998, -1, -3.995]}
                scale={0.001}
              />
            </group>
          </group>
        </group>
        <group
          name="MeBitSanta027"
          position={[-5.387, 4.885, -3.699]}
          rotation={[0, -0.011, 0]}
          scale={[0.01, 0.008, 0.008]}
        >
          <group name="MeBitSanta028">
            <group
              name="Object_39009"
              position={[-0.001, 5.046, -0.01]}
              scale={0.301}
            >
              <mesh
                name="Mesh_68003"
                geometry={nodes.Mesh_68003.geometry}
                material={materials['M_Bake.006']}
                position={[-5.999, -1, -3.995]}
                scale={0.001}
              />
            </group>
          </group>
        </group>
        <group
          name="MeBitSanta029"
          position={[-5.052, 4.901, -3.687]}
          rotation={[-0.112, 0.024, -0.001]}
          scale={[0.013, 0.016, 0.028]}
        >
          <group
            name="gifts001_24006"
            position={[1.205, -0.566, 0]}
            rotation={[0, Math.PI / 4, 0]}
          >
            <group
              name="Object_52002"
              position={[0.286, 0.176, -0.006]}
              scale={0.238}
            >
              <mesh
                name="Mesh_70003"
                geometry={nodes.Mesh_70003.geometry}
                material={materials['christmas_tree.006']}
                position={[-5.999, -1, -3.995]}
                scale={0.001}
              />
            </group>
          </group>
          <group
            name="gifts002_25006"
            position={[-1.51, -0.564, 0]}
            rotation={[0, 0, 0.004]}
          >
            <group
              name="Object_54002"
              position={[0.188, 0.037, 0]}
              scale={0.36}
            >
              <mesh
                name="Mesh_71003"
                geometry={nodes.Mesh_71003.geometry}
                material={materials['christmas_tree.006']}
                position={[-5.999, -1, -3.995]}
                scale={0.001}
              />
            </group>
          </group>
          <group
            name="gifts003_26006"
            position={[-0.743, -0.565, -0.282]}
            rotation={[0, Math.PI / 4, 0]}
          >
            <group
              name="Object_56002"
              position={[0.252, -0.061, 0]}
              scale={0.291}
            >
              <mesh
                name="Mesh_72003"
                geometry={nodes.Mesh_72003.geometry}
                material={materials['christmas_tree.006']}
                position={[-5.999, -1, -3.995]}
                scale={0.001}
              />
            </group>
          </group>
          <group name="gifts_23006" position={[0.289, -0.566, 0.14]}>
            <group
              name="Object_50002"
              position={[0.242, 0.183, -0.007]}
              scale={0.238}
            >
              <mesh
                name="Mesh_73003"
                geometry={nodes.Mesh_73003.geometry}
                material={materials['christmas_tree.006']}
                position={[-5.999, -1, -3.995]}
                scale={0.001}
              />
            </group>
          </group>
          <group
            name="rings001_1006"
            position={[-0.521, 3.021, -0.107]}
            rotation={[0, -0.126, 0]}
          >
            <group
              name="Object_6007"
              position={[-0.003, 0.003, 0]}
              scale={0.044}
            >
              <mesh
                name="Mesh_74003"
                geometry={nodes.Mesh_74003.geometry}
                material={materials['christmas_tree.006']}
                position={[-5.997, -1, -3.995]}
                scale={0.001}
              />
            </group>
          </group>
          <group
            name="rings002_2006"
            position={[0.681, 2.828, 0.223]}
            rotation={[0, 0.126, 0]}
          >
            <group
              name="Object_8002"
              position={[-0.003, 0.003, 0]}
              scale={0.044}
            >
              <mesh
                name="Mesh_75003"
                geometry={nodes.Mesh_75003.geometry}
                material={materials['christmas_tree.006']}
                position={[-5.999, -1, -3.996]}
                scale={0.001}
              />
            </group>
          </group>
          <group
            name="rings003_3006"
            position={[1.05, 2.177, -0.065]}
            rotation={[0, -0.126, 0]}
          >
            <group
              name="Object_10004"
              position={[-0.003, 0.003, 0]}
              scale={0.044}
            >
              <mesh
                name="Mesh_76003"
                geometry={nodes.Mesh_76003.geometry}
                material={materials['christmas_tree.006']}
                position={[-5.997, -0.999, -3.995]}
                scale={0.001}
              />
            </group>
          </group>
          <group
            name="rings004_4006"
            position={[0.793, 1.751, 0.267]}
            rotation={[0, 0.126, 0]}
          >
            <group
              name="Object_12005"
              position={[-0.003, 0.003, 0]}
              scale={0.044}
            >
              <mesh
                name="Mesh_77003"
                geometry={nodes.Mesh_77003.geometry}
                material={materials['christmas_tree.006']}
                position={[-6, -1, -3.995]}
                scale={0.001}
              />
            </group>
          </group>
          <group
            name="rings005_0006"
            position={[-0.685, 2.368, 0.283]}
            rotation={[0, 0.126, 0]}
          >
            <group
              name="Object_4002"
              position={[-0.003, 0.003, 0]}
              scale={0.044}
            >
              <mesh
                name="Mesh_78003"
                geometry={nodes.Mesh_78003.geometry}
                material={materials['christmas_tree.006']}
                position={[-5.999, -1, -3.995]}
                scale={0.001}
              />
            </group>
          </group>
          <group
            name="rings006_5006"
            position={[1.236, 1.374, 0.048]}
            rotation={[0, -0.126, 0]}
          >
            <group
              name="Object_14008"
              position={[-0.003, 0.003, 0]}
              scale={0.044}
            >
              <mesh
                name="Mesh_79003"
                geometry={nodes.Mesh_79003.geometry}
                material={materials['christmas_tree.006']}
                position={[-5.997, -1, -3.995]}
                scale={0.001}
              />
            </group>
          </group>
          <group
            name="rings007_6006"
            position={[1.628, 1.056, -0.216]}
            rotation={[0, 0.126, 0]}
          >
            <group
              name="Object_16008"
              position={[-0.003, 0.003, 0]}
              scale={0.044}
            >
              <mesh
                name="Mesh_80003"
                geometry={nodes.Mesh_80003.geometry}
                material={materials['christmas_tree.006']}
                position={[-5.998, -1, -3.995]}
                scale={0.001}
              />
            </group>
          </group>
          <group
            name="rings008_7006"
            position={[1.661, 0.289, -0.164]}
            rotation={[0, -0.126, 0]}
          >
            <group
              name="Object_18010"
              position={[-0.003, 0.003, 0]}
              scale={0.044}
            >
              <mesh
                name="Mesh_81003"
                geometry={nodes.Mesh_81003.geometry}
                material={materials['christmas_tree.006']}
                position={[-5.997, -1, -3.995]}
                scale={0.001}
              />
            </group>
          </group>
          <group
            name="rings009_8006"
            position={[1.438, -0.138, 0.236]}
            rotation={[0, 0.063, 0]}
          >
            <group
              name="Object_20002"
              position={[-0.003, 0.003, 0]}
              scale={0.044}
            >
              <mesh
                name="Mesh_82003"
                geometry={nodes.Mesh_82003.geometry}
                material={materials['christmas_tree.006']}
                position={[-5.997, -1.001, -3.995]}
                scale={0.001}
              />
            </group>
          </group>
          <group
            name="rings010_9006"
            position={[0.891, -0.248, -0.311]}
            rotation={[0, -0.063, 0]}
          >
            <group
              name="Object_22002"
              position={[-0.004, 0.003, 0]}
              scale={0.044}
            >
              <mesh
                name="Mesh_83003"
                geometry={nodes.Mesh_83003.geometry}
                material={materials['christmas_tree.006']}
                position={[-5.998, -1, -3.995]}
                scale={0.001}
              />
            </group>
          </group>
          <group
            name="rings011_10006"
            position={[-1.201, -0.064, 0.476]}
            rotation={[0, -0.126, 0]}
          >
            <group
              name="Object_24006"
              position={[-0.003, 0.003, 0]}
              scale={0.044}
            >
              <mesh
                name="Mesh_84003"
                geometry={nodes.Mesh_84003.geometry}
                material={materials['christmas_tree.006']}
                position={[-5.997, -0.999, -3.995]}
                scale={0.001}
              />
            </group>
          </group>
          <group
            name="rings012_11006"
            position={[-1.67, -0.066, 0.048]}
            rotation={[0, 0.126, 0]}
          >
            <group
              name="Object_26003"
              position={[-0.003, 0.003, 0]}
              scale={0.044}
            >
              <mesh
                name="Mesh_85003"
                geometry={nodes.Mesh_85003.geometry}
                material={materials['christmas_tree.006']}
                position={[-6.001, -1.001, -3.995]}
                scale={0.001}
              />
            </group>
          </group>
          <group
            name="rings013_12006"
            position={[-1.761, 0.725, -0.239]}
            rotation={[0, -0.126, 0]}
          >
            <group
              name="Object_28005"
              position={[-0.003, 0.003, 0]}
              scale={0.044}
            >
              <mesh
                name="Mesh_86003"
                geometry={nodes.Mesh_86003.geometry}
                material={materials['christmas_tree.006']}
                position={[-6, -1, -3.995]}
                scale={0.001}
              />
            </group>
          </group>
          <group
            name="rings014_13006"
            position={[-1.19, 1.401, 0.645]}
            rotation={[0, 0.126, 0]}
          >
            <group
              name="Object_30003"
              position={[-0.003, 0.003, 0]}
              scale={0.044}
            >
              <mesh
                name="Mesh_87003"
                geometry={nodes.Mesh_87003.geometry}
                material={materials['christmas_tree.006']}
                position={[-6, -1.001, -3.995]}
                scale={0.001}
              />
            </group>
          </group>
          <group
            name="rings015_14006"
            position={[-1.363, 2.006, -0.185]}
            rotation={[0, -0.126, 0]}
          >
            <group
              name="Object_32003"
              position={[-0.003, 0.003, 0]}
              scale={0.044}
            >
              <mesh
                name="Mesh_88003"
                geometry={nodes.Mesh_88003.geometry}
                material={materials['christmas_tree.006']}
                position={[-5.997, -1, -3.996]}
                scale={0.001}
              />
            </group>
          </group>
          <group
            name="star001_19006"
            position={[0.28, 2.608, 0]}
            scale={0.999}
          />
          <group
            name="star002_20006"
            position={[0.195, 2.957, 0]}
            scale={0.999}
          />
          <group
            name="star003_21006"
            position={[-0.195, 2.957, 0]}
            scale={0.999}
          />
          <group
            name="star004_22006"
            position={[-0.28, 2.608, 0]}
            scale={0.999}
          />
        </group>
        <group
          name="Root003"
          position={[-3.368, 4.653, -3.475]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={0.076}
        >
          <group
            name="Camera004"
            position={[-2.878, -0.018, 1.792]}
            rotation={[-0.773, 0.738, 1.971]}
          />
          <group name="PlantAimationBalls003" position={[-0.202, -0.11, 0.085]}>
            <group name="SickPlantSteam002" />
            <primitive object={nodes.Armature_rootJoint} />
            <skinnedMesh
              name="SickPlantSteam_0003"
              geometry={nodes.SickPlantSteam_0003.geometry}
              material={materials['SickPlantSteam_Mat.005']}
              skeleton={nodes.SickPlantSteam_0003.skeleton}
            />
          </group>
        </group>

        <group
          name="MeBitSanta019"
          position={[-5.999, -1.039, -4.064]}
          scale={0.001}
        >
          <mesh
            name="MeBitSanta001"
            geometry={nodes.MeBitSanta001.geometry}
            material={materials['default.007']}
          />
          <mesh
            name="MeBitSanta001_1"
            geometry={nodes.MeBitSanta001_1.geometry}
            material={materials['M_Bake.006']}
          />
          <mesh
            name="MeBitSanta001_2"
            geometry={nodes.MeBitSanta001_2.geometry}
            material={materials['Material.066']}
          />
        </group>
        <mesh
          name="Mesh_69002"
          geometry={nodes.Mesh_69002.geometry}
          material={materials['christmas_tree.006']}
          position={[-5.999, -1.039, -4.064]}
          scale={0.001}
        />
        <mesh
          name="Mesh_89001"
          geometry={nodes.Mesh_89001.geometry}
          material={materials['PaletteMaterial001.104']}
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        />
        <group
          name="BunnyEarsCactus001"
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        >
          <mesh
            name="Mesh_89002"
            geometry={nodes.Mesh_89002.geometry}
            material={materials['lambert1.003']}
          />
          <mesh
            name="Mesh_89002_1"
            geometry={nodes.Mesh_89002_1.geometry}
            material={materials['cactus_04_mat.003']}
          />
          <mesh
            name="Mesh_89002_2"
            geometry={nodes.Mesh_89002_2.geometry}
            material={materials['cactus_04_spike_mat.003']}
          />
          <mesh
            name="Mesh_89002_3"
            geometry={nodes.Mesh_89002_3.geometry}
            material={materials['cactus_ground_mat.003']}
          />
          <mesh
            name="Mesh_89002_4"
            geometry={nodes.Mesh_89002_4.geometry}
            material={materials['cactus_stone_mat.003']}
          />
        </group>
        <group name="PuzzleShelf" position={[-5.999, -1, -3.995]} scale={0.001}>
          <mesh
            name="Mesh_36002"
            geometry={nodes.Mesh_36002.geometry}
            material={materials['Mtl2.010']}
          />
          <mesh
            name="Mesh_36002_1"
            geometry={nodes.Mesh_36002_1.geometry}
            material={materials['baked.010']}
          />
          <mesh
            name="Mesh_36002_2"
            geometry={nodes.Mesh_36002_2.geometry}
            material={materials['RubixCube.010']}
          />
          <mesh
            name="Mesh_36002_3"
            geometry={nodes.Mesh_36002_3.geometry}
            material={materials['PaletteMaterial001.105']}
          />
          <mesh
            name="Mesh_36002_4"
            geometry={nodes.Mesh_36002_4.geometry}
            material={materials['material.030']}
          />
          <mesh
            name="Mesh_36002_5"
            geometry={nodes.Mesh_36002_5.geometry}
            material={materials['PaletteMaterial002.055']}
          />
          <mesh
            name="Mesh_36002_6"
            geometry={nodes.Mesh_36002_6.geometry}
            material={materials['Sticker_SPC-SG.010']}
          />
        </group>
        <group name="Arcade001" position={[-5.999, -1, -3.995]} scale={0.001}>
          <mesh
            name="Mesh_36003"
            geometry={nodes.Mesh_36003.geometry}
            material={materials['PaletteMaterial003.039']}
          />
          <mesh
            name="Mesh_36003_1"
            geometry={nodes.Mesh_36003_1.geometry}
            material={materials['GameBoy.010']}
          />
          <mesh
            name="Mesh_36003_2"
            geometry={nodes.Mesh_36003_2.geometry}
            material={materials['bButton.010']}
          />
          <mesh
            name="Mesh_36003_3"
            geometry={nodes.Mesh_36003_3.geometry}
            material={materials['TT_checker_1024x1024_UV_GRID.020']}
          />
          <mesh
            name="Mesh_36003_4"
            geometry={nodes.Mesh_36003_4.geometry}
            material={materials['ARCADE.011']}
          />
          <mesh
            name="Mesh_36003_5"
            geometry={nodes.Mesh_36003_5.geometry}
            material={materials['PaletteMaterial002.057']}
          />
          <mesh
            name="Mesh_36003_6"
            geometry={nodes.Mesh_36003_6.geometry}
            material={materials['PaletteMaterial003.040']}
          />
          <mesh
            name="Mesh_36003_7"
            geometry={nodes.Mesh_36003_7.geometry}
            material={materials['PaletteMaterial001.106']}
          />
          <mesh
            name="Mesh_36003_8"
            geometry={nodes.Mesh_36003_8.geometry}
            material={materials['PaletteMaterial002.058']}
          />
          <mesh
            name="Mesh_36003_9"
            geometry={nodes.Mesh_36003_9.geometry}
            material={materials['PaletteMaterial004.032']}
          />
          <mesh
            name="Mesh_36003_10"
            geometry={nodes.Mesh_36003_10.geometry}
            material={materials['Stick.010']}
          />
          <mesh
            name="Mesh_36003_11"
            geometry={nodes.Mesh_36003_11.geometry}
            material={materials['lowpoly.010']}
          />
          <mesh
            name="Mesh_36003_12"
            geometry={nodes.Mesh_36003_12.geometry}
            material={materials['GamepadStuff.011']}
          />
          <mesh
            name="Mesh_36003_13"
            geometry={nodes.Mesh_36003_13.geometry}
            material={materials['gamepadMain.011']}
          />
          <mesh
            name="Mesh_36003_14"
            geometry={nodes.Mesh_36003_14.geometry}
            material={materials['PaletteMaterial005.040']}
          />
          <mesh
            name="Mesh_36003_15"
            geometry={nodes.Mesh_36003_15.geometry}
            material={materials['TT_checker_1024x1024_UV_GRID.021']}
          />
          <mesh
            name="Mesh_36003_16"
            geometry={nodes.Mesh_36003_16.geometry}
            material={materials['PaletteMaterial006.022']}
          />
          <mesh
            name="Mesh_36003_17"
            geometry={nodes.Mesh_36003_17.geometry}
            material={materials['controllerbody.010']}
          />
          <mesh
            name="Mesh_36003_18"
            geometry={nodes.Mesh_36003_18.geometry}
            material={materials['material.031']}
          />
          <mesh
            name="Mesh_36003_19"
            geometry={nodes.Mesh_36003_19.geometry}
            material={materials['ANALOG.010']}
          />
          <mesh
            name="Mesh_36003_20"
            geometry={nodes.Mesh_36003_20.geometry}
            material={materials['dpad.010']}
          />
          <mesh
            name="Mesh_36003_21"
            geometry={nodes.Mesh_36003_21.geometry}
            material={materials['cstick.010']}
          />
          <mesh
            name="Mesh_36003_22"
            geometry={nodes.Mesh_36003_22.geometry}
            material={materials['abutton.010']}
          />
          <mesh
            name="Mesh_36003_23"
            geometry={nodes.Mesh_36003_23.geometry}
            material={materials['zbutton.010']}
          />
          <mesh
            name="Mesh_36003_24"
            geometry={nodes.Mesh_36003_24.geometry}
            material={materials['bumpers.010']}
          />
          <mesh
            name="Mesh_36003_25"
            geometry={nodes.Mesh_36003_25.geometry}
            material={materials['PaletteMaterial001.107']}
          />
        </group>
        <mesh
          name="RoomFloor"
          geometry={nodes.RoomFloor.geometry}
          material={materials['Material.068']}
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        />
        <mesh
          name="TvMonoitor"
          geometry={nodes.TvMonoitor.geometry}
          material={materials['Material.069']}
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        />
        <mesh
          name="MonitorScreen"
          geometry={nodes.MonitorScreen.geometry}
          material={materials['Material.070']}
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        />
        <mesh
          name="KitchenSet001"
          geometry={nodes.KitchenSet001.geometry}
          material={materials['PaletteMaterial001.108']}
          position={[-5.999, -0.966, -3.995]}
          scale={0.001}
        />
        <group name="TopShelf" position={[-5.999, -1, -3.995]} scale={0.001}>
          <mesh
            name="Mesh_36011"
            geometry={nodes.Mesh_36011.geometry}
            material={materials['PaletteMaterial001.100']}
          />
          <mesh
            name="Mesh_36011_1"
            geometry={nodes.Mesh_36011_1.geometry}
            material={materials['Material.071']}
          />
        </group>
        <group
          name="MeBitBalloon001"
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        >
          <mesh
            name="Mesh_36012"
            geometry={nodes.Mesh_36012.geometry}
            material={materials['baloon.012']}
          />
          <mesh
            name="Mesh_36012_1"
            geometry={nodes.Mesh_36012_1.geometry}
            material={materials['baloon.013']}
          />
          <mesh
            name="Mesh_36012_2"
            geometry={nodes.Mesh_36012_2.geometry}
            material={materials['PaletteMaterial001.109']}
          />
        </group>
        <group name="MeSubBit" position={[-5.999, -1, -3.995]} scale={0.001}>
          <mesh
            name="Mesh_44001"
            geometry={nodes.Mesh_44001.geometry}
            material={materials['Glass.013']}
          />
          <mesh
            name="Mesh_44001_1"
            geometry={nodes.Mesh_44001_1.geometry}
            material={materials['PaletteMaterial001.101']}
          />
          <mesh
            name="Mesh_44001_2"
            geometry={nodes.Mesh_44001_2.geometry}
            material={materials['Material.072']}
          />
        </group>
        <mesh
          name="Mesh_39004"
          geometry={nodes.Mesh_39004.geometry}
          material={nodes.Mesh_39004.material}
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        />
        <group name="MeBitCar002" position={[-5.999, -1, -3.995]} scale={0.001}>
          <mesh
            name="Mesh_39004_1"
            geometry={nodes.Mesh_39004_1.geometry}
            material={materials['PaletteMaterial001.110']}
          />
          <mesh
            name="Mesh_39004_2"
            geometry={nodes.Mesh_39004_2.geometry}
            material={materials['forMayaAOrear_lights.006']}
          />
          <mesh
            name="Mesh_39004_3"
            geometry={nodes.Mesh_39004_3.geometry}
            material={materials['forMayaAOnumber.006']}
          />
          <mesh
            name="Mesh_39004_4"
            geometry={nodes.Mesh_39004_4.geometry}
            material={materials['forMayaAOlambert15.005']}
          />
          <mesh
            name="Mesh_39004_5"
            geometry={nodes.Mesh_39004_5.geometry}
            material={materials['forMayaAOlambert16.006']}
          />
          <mesh
            name="Mesh_39004_6"
            geometry={nodes.Mesh_39004_6.geometry}
            material={materials['forMayaAOblinn6.005']}
          />
          <mesh
            name="Mesh_39004_7"
            geometry={nodes.Mesh_39004_7.geometry}
            material={materials['PaletteMaterial002.059']}
          />
          <mesh
            name="Mesh_39004_8"
            geometry={nodes.Mesh_39004_8.geometry}
            material={materials['forMayaAOGrill2.006']}
          />
          <mesh
            name="Mesh_39004_9"
            geometry={nodes.Mesh_39004_9.geometry}
            material={materials['Chrome_2.006']}
          />
          <mesh
            name="Mesh_39004_10"
            geometry={nodes.Mesh_39004_10.geometry}
            material={materials['PaletteMaterial003.041']}
          />
          <mesh
            name="Mesh_39004_11"
            geometry={nodes.Mesh_39004_11.geometry}
            material={materials['material.032']}
          />
        </group>
        <group
          name="MeBitFatty008"
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        >
          <mesh
            name="Mesh_39005"
            geometry={nodes.Mesh_39005.geometry}
            material={materials['Tassels.006']}
          />
          <mesh
            name="Mesh_39005_1"
            geometry={nodes.Mesh_39005_1.geometry}
            material={materials['PaletteMaterial001.111']}
          />
          <mesh
            name="Mesh_39005_2"
            geometry={nodes.Mesh_39005_2.geometry}
            material={materials['PaletteMaterial001.112']}
          />
          <mesh
            name="Mesh_39005_3"
            geometry={nodes.Mesh_39005_3.geometry}
            material={materials['PaletteMaterial001.103']}
          />
          <mesh
            name="Mesh_39005_4"
            geometry={nodes.Mesh_39005_4.geometry}
            material={materials['Carpet.002']}
          />
        </group>
        <group name="MeBitUFO001" position={[-5.999, -1, -3.995]} scale={0.001}>
          <mesh
            name="Mesh_39006"
            geometry={nodes.Mesh_39006.geometry}
            material={materials['PaletteMaterial001.113']}
          />
          <mesh
            name="Mesh_39006_1"
            geometry={nodes.Mesh_39006_1.geometry}
            material={materials['PaletteMaterial007.020']}
          />
          <mesh
            name="Mesh_39006_2"
            geometry={nodes.Mesh_39006_2.geometry}
            material={materials['PaletteMaterial005.042']}
          />
          <mesh
            name="Mesh_39006_3"
            geometry={nodes.Mesh_39006_3.geometry}
            material={materials['PaletteMaterial004.033']}
          />
          <mesh
            name="Mesh_39006_4"
            geometry={nodes.Mesh_39006_4.geometry}
            material={materials['PaletteMaterial012.006']}
          />
          <mesh
            name="Mesh_39006_5"
            geometry={nodes.Mesh_39006_5.geometry}
            material={materials['PaletteMaterial002.060']}
          />
          <mesh
            name="Mesh_39006_6"
            geometry={nodes.Mesh_39006_6.geometry}
            material={materials['PaletteMaterial006.023']}
          />
          <mesh
            name="Mesh_39006_7"
            geometry={nodes.Mesh_39006_7.geometry}
            material={materials['PaletteMaterial008.019']}
          />
          <mesh
            name="Mesh_39006_8"
            geometry={nodes.Mesh_39006_8.geometry}
            material={materials['PaletteMaterial009.013']}
          />
          <mesh
            name="Mesh_39006_9"
            geometry={nodes.Mesh_39006_9.geometry}
            material={materials['PaletteMaterial010.013']}
          />
          <mesh
            name="Mesh_39006_10"
            geometry={nodes.Mesh_39006_10.geometry}
            material={materials['PaletteMaterial011.006']}
          />
        </group>
        <group
          name="MeBitPlant001"
          position={[-1.018, 1.437, -2.908]}
          rotation={[-1.477, Math.PI / 2, 0]}
          scale={[0.352, 0.352, 0.896]}
        >
          <mesh
            name="armHoles_LP_UV_checker_0001"
            geometry={nodes.armHoles_LP_UV_checker_0001.geometry}
            material={materials['UV_checker.005']}
          />
          <mesh
            name="armHoles_LP_UV_checker_0001_1"
            geometry={nodes.armHoles_LP_UV_checker_0001_1.geometry}
            material={materials['UV_checker.006']}
          />
          <mesh
            name="armHoles_LP_UV_checker_0001_2"
            geometry={nodes.armHoles_LP_UV_checker_0001_2.geometry}
            material={materials['UV_checker.007']}
          />
          <mesh
            name="armHoles_LP_UV_checker_0001_3"
            geometry={nodes.armHoles_LP_UV_checker_0001_3.geometry}
            material={materials['PaletteMaterial001.114']}
          />
        </group>
        <group
          name="MeBitBoat001"
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        >
          <mesh
            name="Mesh_89003"
            geometry={nodes.Mesh_89003.geometry}
            material={materials['Material.073']}
          />
          <mesh
            name="Mesh_89003_1"
            geometry={nodes.Mesh_89003_1.geometry}
            material={materials['SVGMat.007']}
          />
          <mesh
            name="Mesh_89003_2"
            geometry={nodes.Mesh_89003_2.geometry}
            material={materials['Material.074']}
          />
          <mesh
            name="Mesh_89003_3"
            geometry={nodes.Mesh_89003_3.geometry}
            material={materials['Material.075']}
          />
          <mesh
            name="Mesh_89003_4"
            geometry={nodes.Mesh_89003_4.geometry}
            material={materials['PaletteMaterial001.115']}
          />
        </group>
        <mesh
          name="GraphicRight001"
          geometry={nodes.GraphicRight001.geometry}
          material={materials['Material.076']}
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        />
        <mesh
          name="GraphicMiddle"
          geometry={nodes.GraphicMiddle.geometry}
          material={materials['Material.076']}
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        />
        <mesh
          name="GraphicLeft001"
          geometry={nodes.GraphicLeft001.geometry}
          material={materials['Material.076']}
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        />
        <group
          name="HangingLightRight"
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        >
          <mesh
            name="HangingLightRight_1"
            geometry={nodes.HangingLightRight_1.geometry}
            material={materials['PaletteMaterial001.100']}
          />
          <mesh
            name="HangingLightRight_2"
            geometry={nodes.HangingLightRight_2.geometry}
            material={materials['PaletteMaterial002.061']}
          />
        </group>
        <mesh
          name="RoomWall"
          geometry={nodes.RoomWall.geometry}
          material={materials['Material.077']}
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        />
        <group
          name="HangingLightLeft001"
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        >
          <mesh
            name="Mesh_36019"
            geometry={nodes.Mesh_36019.geometry}
            material={materials['PaletteMaterial001.100']}
          />
          <mesh
            name="Mesh_36019_1"
            geometry={nodes.Mesh_36019_1.geometry}
            material={materials['PaletteMaterial002.061']}
          />
        </group>
        <mesh
          name="TableCup"
          geometry={nodes.TableCup.geometry}
          material={materials['PaletteMaterial001.100']}
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        />
        <mesh
          name="TableRemote"
          geometry={nodes.TableRemote.geometry}
          material={materials['PaletteMaterial001.100']}
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        />
        <mesh
          name="ComputerDesk001"
          geometry={nodes.ComputerDesk001.geometry}
          material={materials['PaletteMaterial001.100']}
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        />
        <mesh
          name="TvMonitorFrame"
          geometry={nodes.TvMonitorFrame.geometry}
          material={materials['PaletteMaterial001.100']}
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        />
        <mesh
          name="MonitorStand"
          geometry={nodes.MonitorStand.geometry}
          material={materials['PaletteMaterial001.100']}
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        />
        <mesh
          name="TV_Stand"
          geometry={nodes.TV_Stand.geometry}
          material={materials['PaletteMaterial001.100']}
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        />
        <group
          name="GraphicLeftFrame001"
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        >
          <mesh
            name="Mesh_36027"
            geometry={nodes.Mesh_36027.geometry}
            material={materials['PaletteMaterial001.100']}
          />
          <mesh
            name="Mesh_36027_1"
            geometry={nodes.Mesh_36027_1.geometry}
            material={materials['Material.076']}
          />
        </group>
        <group
          name="GraphicMiddleFrame002"
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        >
          <mesh
            name="Mesh_36028"
            geometry={nodes.Mesh_36028.geometry}
            material={materials['PaletteMaterial001.100']}
          />
          <mesh
            name="Mesh_36028_1"
            geometry={nodes.Mesh_36028_1.geometry}
            material={materials['Material.076']}
          />
        </group>
        <mesh
          name="HeadsetStand001"
          geometry={nodes.HeadsetStand001.geometry}
          material={materials['PaletteMaterial001.100']}
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        />
        <group
          name="GraphicRightFrame001"
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        >
          <mesh
            name="Mesh_36033"
            geometry={nodes.Mesh_36033.geometry}
            material={materials['PaletteMaterial001.100']}
          />
          <mesh
            name="Mesh_36033_1"
            geometry={nodes.Mesh_36033_1.geometry}
            material={materials['Material.076']}
          />
        </group>
        <group name="MiddleTable" position={[-5.999, -1, -3.995]} scale={0.001}>
          <mesh
            name="Mesh_36035"
            geometry={nodes.Mesh_36035.geometry}
            material={materials['Material.071']}
          />
          <mesh
            name="Mesh_36035_1"
            geometry={nodes.Mesh_36035_1.geometry}
            material={materials['PaletteMaterial001.100']}
          />
        </group>
        <group name="Computer" position={[-5.999, -1, -3.995]} scale={0.001}>
          <mesh
            name="Mesh_36041"
            geometry={nodes.Mesh_36041.geometry}
            material={materials['PaletteMaterial001.100']}
          />
          <mesh
            name="Mesh_36041_1"
            geometry={nodes.Mesh_36041_1.geometry}
            material={materials['PaletteMaterial007.021']}
          />
          <mesh
            name="Mesh_36041_2"
            geometry={nodes.Mesh_36041_2.geometry}
            material={materials['PaletteMaterial002.061']}
          />
        </group>
        <mesh
          name="MeBitCthulu"
          geometry={nodes.MeBitCthulu.geometry}
          material={materials['PaletteMaterial001.116']}
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        />
        <mesh
          name="WallLights"
          geometry={nodes.WallLights.geometry}
          material={materials['PaletteMaterial006.024']}
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        />
        <group
          name="KeyboardMouse001"
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        >
          <mesh
            name="Mesh_36044"
            geometry={nodes.Mesh_36044.geometry}
            material={materials['PaletteMaterial008.020']}
          />
          <mesh
            name="Mesh_36044_1"
            geometry={nodes.Mesh_36044_1.geometry}
            material={materials['PaletteMaterial001.100']}
          />
          <mesh
            name="Mesh_36044_2"
            geometry={nodes.Mesh_36044_2.geometry}
            material={materials['PaletteMaterial001.117']}
          />
          <mesh
            name="Mesh_36044_3"
            geometry={nodes.Mesh_36044_3.geometry}
            material={materials['PaletteMaterial001.118']}
          />
        </group>
        <mesh
          name="MeBitChandelier001"
          geometry={nodes.MeBitChandelier001.geometry}
          material={materials['PaletteMaterial005.043']}
          position={[0.163, 6.558, 0.312]}
          rotation={[1.505, 0, -3.141]}
          scale={[2.208, 0.261, 2.212]}
        />
        <group
          name="HangingLightMiddle001"
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        >
          <mesh
            name="Mesh_36045"
            geometry={nodes.Mesh_36045.geometry}
            material={materials['PaletteMaterial001.100']}
          />
          <mesh
            name="Mesh_36045_1"
            geometry={nodes.Mesh_36045_1.geometry}
            material={materials['PaletteMaterial002.061']}
          />
        </group>
        <mesh
          name="Speakers010"
          geometry={nodes.Speakers010.geometry}
          material={materials['PaletteMaterial001.119']}
          position={[4.076, 2.23, -2.919]}
          scale={[0.22, 0.499, 0.499]}
        />
        <group
          name="MeBitHelmet"
          position={[-5.089, 3.661, -3.47]}
          scale={0.325}
        >
          <mesh
            name="MeBitHelmet_1"
            geometry={nodes.MeBitHelmet_1.geometry}
            material={materials['soft.002']}
          />
          <mesh
            name="MeBitHelmet_2"
            geometry={nodes.MeBitHelmet_2.geometry}
            material={materials['PaletteMaterial005.044']}
          />
          <mesh
            name="MeBitHelmet_3"
            geometry={nodes.MeBitHelmet_3.geometry}
            material={materials['base.002']}
          />
        </group>
        <mesh
          name="Couch2001"
          geometry={nodes.Couch2001.geometry}
          material={materials['Material.078']}
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        />
        <mesh
          name="GameZone001"
          geometry={nodes.GameZone001.geometry}
          material={materials['PaletteMaterial002.061']}
          position={[1.96, 5.334, -3.059]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={3.749}
        />
        <group
          name="XBOX"
          position={[4.076, 2.23, -2.919]}
          scale={[0.22, 0.499, 0.499]}
        >
          <mesh
            name="Cube002"
            geometry={nodes.Cube002.geometry}
            material={materials['PaletteMaterial001.121']}
          />
          <mesh
            name="Cube002_1"
            geometry={nodes.Cube002_1.geometry}
            material={materials['Material.079']}
          />
        </group>
        <mesh
          name="PS5002"
          geometry={nodes.PS5002.geometry}
          material={materials['PaletteMaterial001.121']}
          position={[4.076, 2.23, -2.919]}
          scale={[0.22, 0.499, 0.499]}
        />
        <mesh
          name="DVDPlayer002"
          geometry={nodes.DVDPlayer002.geometry}
          material={materials['PaletteMaterial001.121']}
          position={[4.076, 2.23, -2.919]}
          scale={[0.22, 0.499, 0.499]}
        />
        <mesh
          name="CableBox002"
          geometry={nodes.CableBox002.geometry}
          material={materials['PaletteMaterial001.121']}
          position={[4.076, 2.23, -2.919]}
          scale={[0.22, 0.499, 0.499]}
        />
        <mesh
          name="ShelfKeyboard"
          geometry={nodes.ShelfKeyboard.geometry}
          material={materials['PaletteMaterial001.122']}
          position={[4.242, 2.23, -2.919]}
          scale={[0.22, 0.499, 0.499]}
        />
        <group
          name="RoomDisplayOne"
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        >
          <mesh
            name="RoomDisplayOne001"
            geometry={nodes.RoomDisplayOne001.geometry}
            material={materials['PaletteMaterial001.123']}
          />
          <mesh
            name="RoomDisplayOne001_1"
            geometry={nodes.RoomDisplayOne001_1.geometry}
            material={materials['blinn4SG.005']}
          />
          <mesh
            name="RoomDisplayOne001_2"
            geometry={nodes.RoomDisplayOne001_2.geometry}
            material={materials['PaletteMaterial004.034']}
          />
          <mesh
            name="RoomDisplayOne001_3"
            geometry={nodes.RoomDisplayOne001_3.geometry}
            material={materials['lambert7SG.006']}
          />
          <mesh
            name="RoomDisplayOne001_4"
            geometry={nodes.RoomDisplayOne001_4.geometry}
            material={materials['PaletteMaterial008.021']}
          />
          <mesh
            name="RoomDisplayOne001_5"
            geometry={nodes.RoomDisplayOne001_5.geometry}
            material={materials['PaletteMaterial009.014']}
          />
          <mesh
            name="RoomDisplayOne001_6"
            geometry={nodes.RoomDisplayOne001_6.geometry}
            material={materials['equalizer.011']}
          />
          <mesh
            name="RoomDisplayOne001_7"
            geometry={nodes.RoomDisplayOne001_7.geometry}
            material={materials['blackInternal.012']}
          />
          <mesh
            name="RoomDisplayOne001_8"
            geometry={nodes.RoomDisplayOne001_8.geometry}
            material={materials['blackFabric.012']}
          />
          <mesh
            name="RoomDisplayOne001_9"
            geometry={nodes.RoomDisplayOne001_9.geometry}
            material={materials['PaletteMaterial010.014']}
          />
          <mesh
            name="RoomDisplayOne001_10"
            geometry={nodes.RoomDisplayOne001_10.geometry}
            material={materials['PaletteMaterial007.022']}
          />
          <mesh
            name="RoomDisplayOne001_11"
            geometry={nodes.RoomDisplayOne001_11.geometry}
            material={materials['frontColor.011']}
          />
          <mesh
            name="RoomDisplayOne001_12"
            geometry={nodes.RoomDisplayOne001_12.geometry}
            material={materials['PaletteMaterial005.045']}
          />
          <mesh
            name="RoomDisplayOne001_13"
            geometry={nodes.RoomDisplayOne001_13.geometry}
            material={materials['TT_checker_1024x1024_UV_GRID.022']}
          />
          <mesh
            name="RoomDisplayOne001_14"
            geometry={nodes.RoomDisplayOne001_14.geometry}
            material={materials['ARCADE.012']}
          />
          <mesh
            name="RoomDisplayOne001_15"
            geometry={nodes.RoomDisplayOne001_15.geometry}
            material={materials['PaletteMaterial002.062']}
          />
          <mesh
            name="RoomDisplayOne001_16"
            geometry={nodes.RoomDisplayOne001_16.geometry}
            material={materials['PaletteMaterial003.042']}
          />
          <mesh
            name="RoomDisplayOne001_17"
            geometry={nodes.RoomDisplayOne001_17.geometry}
            material={materials['PaletteMaterial001.124']}
          />
          <mesh
            name="RoomDisplayOne001_18"
            geometry={nodes.RoomDisplayOne001_18.geometry}
            material={materials['PaletteMaterial002.063']}
          />
          <mesh
            name="RoomDisplayOne001_19"
            geometry={nodes.RoomDisplayOne001_19.geometry}
            material={materials['PaletteMaterial003.043']}
          />
          <mesh
            name="RoomDisplayOne001_20"
            geometry={nodes.RoomDisplayOne001_20.geometry}
            material={materials['Stick.011']}
          />
          <mesh
            name="RoomDisplayOne001_21"
            geometry={nodes.RoomDisplayOne001_21.geometry}
            material={materials['GameBoy.011']}
          />
          <mesh
            name="RoomDisplayOne001_22"
            geometry={nodes.RoomDisplayOne001_22.geometry}
            material={materials['lowpoly.011']}
          />
          <mesh
            name="RoomDisplayOne001_23"
            geometry={nodes.RoomDisplayOne001_23.geometry}
            material={materials['GamepadStuff.012']}
          />
          <mesh
            name="RoomDisplayOne001_24"
            geometry={nodes.RoomDisplayOne001_24.geometry}
            material={materials['gamepadMain.012']}
          />
          <mesh
            name="RoomDisplayOne001_25"
            geometry={nodes.RoomDisplayOne001_25.geometry}
            material={materials['Sticker_SPC-SG.011']}
          />
          <mesh
            name="RoomDisplayOne001_26"
            geometry={nodes.RoomDisplayOne001_26.geometry}
            material={materials['baked.011']}
          />
          <mesh
            name="RoomDisplayOne001_27"
            geometry={nodes.RoomDisplayOne001_27.geometry}
            material={materials['RubixCube.011']}
          />
          <mesh
            name="RoomDisplayOne001_28"
            geometry={nodes.RoomDisplayOne001_28.geometry}
            material={materials['PaletteMaterial005.046']}
          />
          <mesh
            name="RoomDisplayOne001_29"
            geometry={nodes.RoomDisplayOne001_29.geometry}
            material={materials['TT_checker_1024x1024_UV_GRID.023']}
          />
          <mesh
            name="RoomDisplayOne001_30"
            geometry={nodes.RoomDisplayOne001_30.geometry}
            material={materials['PaletteMaterial006.025']}
          />
          <mesh
            name="RoomDisplayOne001_31"
            geometry={nodes.RoomDisplayOne001_31.geometry}
            material={materials['controllerbody.011']}
          />
          <mesh
            name="RoomDisplayOne001_32"
            geometry={nodes.RoomDisplayOne001_32.geometry}
            material={materials['material.033']}
          />
          <mesh
            name="RoomDisplayOne001_33"
            geometry={nodes.RoomDisplayOne001_33.geometry}
            material={materials['ANALOG.011']}
          />
          <mesh
            name="RoomDisplayOne001_34"
            geometry={nodes.RoomDisplayOne001_34.geometry}
            material={materials['dpad.011']}
          />
          <mesh
            name="RoomDisplayOne001_35"
            geometry={nodes.RoomDisplayOne001_35.geometry}
            material={materials['cstick.011']}
          />
          <mesh
            name="RoomDisplayOne001_36"
            geometry={nodes.RoomDisplayOne001_36.geometry}
            material={materials['bumpers.011']}
          />
          <mesh
            name="RoomDisplayOne001_37"
            geometry={nodes.RoomDisplayOne001_37.geometry}
            material={materials['PaletteMaterial002.064']}
          />
          <mesh
            name="RoomDisplayOne001_38"
            geometry={nodes.RoomDisplayOne001_38.geometry}
            material={materials['Mtl2.011']}
          />
          <mesh
            name="RoomDisplayOne001_39"
            geometry={nodes.RoomDisplayOne001_39.geometry}
            material={materials['material.034']}
          />
          <mesh
            name="RoomDisplayOne001_40"
            geometry={nodes.RoomDisplayOne001_40.geometry}
            material={materials['PaletteMaterial004.035']}
          />
        </group>
        <group
          name="RoomDisplayTwo"
          position={[-5.998, -1.369, -3.938]}
          rotation={[0, 0, 0.061]}
          scale={0.001}
        >
          <mesh
            name="RoomDisplayTwo001"
            geometry={nodes.RoomDisplayTwo001.geometry}
            material={materials['blinn4SG.006']}
          />
          <mesh
            name="RoomDisplayTwo001_1"
            geometry={nodes.RoomDisplayTwo001_1.geometry}
            material={materials['OfficeChair.004']}
          />
          <mesh
            name="RoomDisplayTwo001_2"
            geometry={nodes.RoomDisplayTwo001_2.geometry}
            material={materials['Tables.004']}
          />
          <mesh
            name="RoomDisplayTwo001_3"
            geometry={nodes.RoomDisplayTwo001_3.geometry}
            material={materials['PaletteMaterial007.023']}
          />
          <mesh
            name="RoomDisplayTwo001_4"
            geometry={nodes.RoomDisplayTwo001_4.geometry}
            material={materials['Papers.004']}
          />
          <mesh
            name="RoomDisplayTwo001_5"
            geometry={nodes.RoomDisplayTwo001_5.geometry}
            material={materials['Pipe.004']}
          />
          <mesh
            name="RoomDisplayTwo001_6"
            geometry={nodes.RoomDisplayTwo001_6.geometry}
            material={materials['Plant.004']}
          />
          <mesh
            name="RoomDisplayTwo001_7"
            geometry={nodes.RoomDisplayTwo001_7.geometry}
            material={materials['Material_0.007']}
          />
          <mesh
            name="RoomDisplayTwo001_8"
            geometry={nodes.RoomDisplayTwo001_8.geometry}
            material={materials['MeditationSanta_Model_9_u1_v1.007']}
          />
          <mesh
            name="RoomDisplayTwo001_9"
            geometry={nodes.RoomDisplayTwo001_9.geometry}
            material={materials['material_0.015']}
          />
          <mesh
            name="RoomDisplayTwo001_10"
            geometry={nodes.RoomDisplayTwo001_10.geometry}
            material={materials['material.035']}
          />
          <mesh
            name="RoomDisplayTwo001_11"
            geometry={nodes.RoomDisplayTwo001_11.geometry}
            material={materials['Sticker_SPC-SG.012']}
          />
          <mesh
            name="RoomDisplayTwo001_12"
            geometry={nodes.RoomDisplayTwo001_12.geometry}
            material={materials['baked.012']}
          />
          <mesh
            name="RoomDisplayTwo001_13"
            geometry={nodes.RoomDisplayTwo001_13.geometry}
            material={materials['RubixCube.012']}
          />
          <mesh
            name="RoomDisplayTwo001_14"
            geometry={nodes.RoomDisplayTwo001_14.geometry}
            material={materials['PaletteMaterial005.047']}
          />
          <mesh
            name="RoomDisplayTwo001_15"
            geometry={nodes.RoomDisplayTwo001_15.geometry}
            material={materials['Mtl2.012']}
          />
          <mesh
            name="RoomDisplayTwo001_16"
            geometry={nodes.RoomDisplayTwo001_16.geometry}
            material={materials['material.036']}
          />
          <mesh
            name="RoomDisplayTwo001_17"
            geometry={nodes.RoomDisplayTwo001_17.geometry}
            material={materials['Glass.014']}
          />
          <mesh
            name="RoomDisplayTwo001_18"
            geometry={nodes.RoomDisplayTwo001_18.geometry}
            material={materials['PaletteMaterial003.044']}
          />
          <mesh
            name="RoomDisplayTwo001_19"
            geometry={nodes.RoomDisplayTwo001_19.geometry}
            material={materials['Sofa.004']}
          />
          <mesh
            name="RoomDisplayTwo001_20"
            geometry={nodes.RoomDisplayTwo001_20.geometry}
            material={materials['Camera.004']}
          />
          <mesh
            name="RoomDisplayTwo001_21"
            geometry={nodes.RoomDisplayTwo001_21.geometry}
            material={materials['Walls.004']}
          />
          <mesh
            name="RoomDisplayTwo001_22"
            geometry={nodes.RoomDisplayTwo001_22.geometry}
            material={materials['PaletteMaterial001.125']}
          />
          <mesh
            name="RoomDisplayTwo001_23"
            geometry={nodes.RoomDisplayTwo001_23.geometry}
            material={materials['lambert7SG.007']}
          />
          <mesh
            name="RoomDisplayTwo001_24"
            geometry={nodes.RoomDisplayTwo001_24.geometry}
            material={materials['Airlock.004']}
          />
          <mesh
            name="RoomDisplayTwo001_25"
            geometry={nodes.RoomDisplayTwo001_25.geometry}
            material={materials['AirPipe.004']}
          />
          <mesh
            name="RoomDisplayTwo001_26"
            geometry={nodes.RoomDisplayTwo001_26.geometry}
            material={materials['AmmoBox.004']}
          />
          <mesh
            name="RoomDisplayTwo001_27"
            geometry={nodes.RoomDisplayTwo001_27.geometry}
            material={materials['GameBoy.012']}
          />
          <mesh
            name="RoomDisplayTwo001_28"
            geometry={nodes.RoomDisplayTwo001_28.geometry}
            material={materials['TT_checker_1024x1024_UV_GRID.024']}
          />
          <mesh
            name="RoomDisplayTwo001_29"
            geometry={nodes.RoomDisplayTwo001_29.geometry}
            material={materials['ARCADE.013']}
          />
          <mesh
            name="RoomDisplayTwo001_30"
            geometry={nodes.RoomDisplayTwo001_30.geometry}
            material={materials['PaletteMaterial002.065']}
          />
          <mesh
            name="RoomDisplayTwo001_31"
            geometry={nodes.RoomDisplayTwo001_31.geometry}
            material={materials['PaletteMaterial003.045']}
          />
          <mesh
            name="RoomDisplayTwo001_32"
            geometry={nodes.RoomDisplayTwo001_32.geometry}
            material={materials['PaletteMaterial001.126']}
          />
          <mesh
            name="RoomDisplayTwo001_33"
            geometry={nodes.RoomDisplayTwo001_33.geometry}
            material={materials['PaletteMaterial002.066']}
          />
          <mesh
            name="RoomDisplayTwo001_34"
            geometry={nodes.RoomDisplayTwo001_34.geometry}
            material={materials['PaletteMaterial002.067']}
          />
          <mesh
            name="RoomDisplayTwo001_35"
            geometry={nodes.RoomDisplayTwo001_35.geometry}
            material={materials['Stick.012']}
          />
          <mesh
            name="RoomDisplayTwo001_36"
            geometry={nodes.RoomDisplayTwo001_36.geometry}
            material={materials['lowpoly.012']}
          />
          <mesh
            name="RoomDisplayTwo001_37"
            geometry={nodes.RoomDisplayTwo001_37.geometry}
            material={materials['GamepadStuff.013']}
          />
          <mesh
            name="RoomDisplayTwo001_38"
            geometry={nodes.RoomDisplayTwo001_38.geometry}
            material={materials['gamepadMain.013']}
          />
          <mesh
            name="RoomDisplayTwo001_39"
            geometry={nodes.RoomDisplayTwo001_39.geometry}
            material={materials['TT_checker_1024x1024_UV_GRID.025']}
          />
          <mesh
            name="RoomDisplayTwo001_40"
            geometry={nodes.RoomDisplayTwo001_40.geometry}
            material={materials['PaletteMaterial004.036']}
          />
          <mesh
            name="RoomDisplayTwo001_41"
            geometry={nodes.RoomDisplayTwo001_41.geometry}
            material={materials['controllerbody.012']}
          />
          <mesh
            name="RoomDisplayTwo001_42"
            geometry={nodes.RoomDisplayTwo001_42.geometry}
            material={materials['material.037']}
          />
          <mesh
            name="RoomDisplayTwo001_43"
            geometry={nodes.RoomDisplayTwo001_43.geometry}
            material={materials['ANALOG.012']}
          />
          <mesh
            name="RoomDisplayTwo001_44"
            geometry={nodes.RoomDisplayTwo001_44.geometry}
            material={materials['cstick.012']}
          />
          <mesh
            name="RoomDisplayTwo001_45"
            geometry={nodes.RoomDisplayTwo001_45.geometry}
            material={materials['bumpers.012']}
          />
          <mesh
            name="RoomDisplayTwo001_46"
            geometry={nodes.RoomDisplayTwo001_46.geometry}
            material={materials['PaletteMaterial001.127']}
          />
          <mesh
            name="RoomDisplayTwo001_47"
            geometry={nodes.RoomDisplayTwo001_47.geometry}
            material={materials['baloon.014']}
          />
          <mesh
            name="RoomDisplayTwo001_48"
            geometry={nodes.RoomDisplayTwo001_48.geometry}
            material={materials['baloon.015']}
          />
          <mesh
            name="RoomDisplayTwo001_49"
            geometry={nodes.RoomDisplayTwo001_49.geometry}
            material={materials['BedFrame.004']}
          />
          <mesh
            name="RoomDisplayTwo001_50"
            geometry={nodes.RoomDisplayTwo001_50.geometry}
            material={materials['BedFabrics.004']}
          />
          <mesh
            name="RoomDisplayTwo001_51"
            geometry={nodes.RoomDisplayTwo001_51.geometry}
            material={materials['CeillingLamp.004']}
          />
          <mesh
            name="RoomDisplayTwo001_52"
            geometry={nodes.RoomDisplayTwo001_52.geometry}
            material={materials['Chair.004']}
          />
          <mesh
            name="RoomDisplayTwo001_53"
            geometry={nodes.RoomDisplayTwo001_53.geometry}
            material={materials['ChairMetal.004']}
          />
          <mesh
            name="RoomDisplayTwo001_54"
            geometry={nodes.RoomDisplayTwo001_54.geometry}
            material={materials['ChineseSoldier.004']}
          />
          <mesh
            name="RoomDisplayTwo001_55"
            geometry={nodes.RoomDisplayTwo001_55.geometry}
            material={materials['PaletteMaterial001.128']}
          />
          <mesh
            name="RoomDisplayTwo001_56"
            geometry={nodes.RoomDisplayTwo001_56.geometry}
            material={materials['02_-_Default.005']}
          />
          <mesh
            name="RoomDisplayTwo001_57"
            geometry={nodes.RoomDisplayTwo001_57.geometry}
            material={materials['04_-_Default.005']}
          />
          <mesh
            name="RoomDisplayTwo001_58"
            geometry={nodes.RoomDisplayTwo001_58.geometry}
            material={materials['DecorativePanels.004']}
          />
          <mesh
            name="RoomDisplayTwo001_59"
            geometry={nodes.RoomDisplayTwo001_59.geometry}
            material={materials['Door.004']}
          />
          <mesh
            name="RoomDisplayTwo001_60"
            geometry={nodes.RoomDisplayTwo001_60.geometry}
            material={materials['Ventilation.004']}
          />
          <mesh
            name="RoomDisplayTwo001_61"
            geometry={nodes.RoomDisplayTwo001_61.geometry}
            material={materials['Material.080']}
          />
          <mesh
            name="RoomDisplayTwo001_62"
            geometry={nodes.RoomDisplayTwo001_62.geometry}
            material={materials['PaletteMaterial005.048']}
          />
          <mesh
            name="RoomDisplayTwo001_63"
            geometry={nodes.RoomDisplayTwo001_63.geometry}
            material={materials['PaletteMaterial006.026']}
          />
          <mesh
            name="RoomDisplayTwo001_64"
            geometry={nodes.RoomDisplayTwo001_64.geometry}
            material={materials['Keyboard.004']}
          />
          <mesh
            name="RoomDisplayTwo001_65"
            geometry={nodes.RoomDisplayTwo001_65.geometry}
            material={materials['VentLeder.004']}
          />
          <mesh
            name="RoomDisplayTwo001_66"
            geometry={nodes.RoomDisplayTwo001_66.geometry}
            material={materials['MonitorMouse.004']}
          />
          <mesh
            name="RoomDisplayTwo001_67"
            geometry={nodes.RoomDisplayTwo001_67.geometry}
            material={materials['forMayaAOlambert16.007']}
          />
          <mesh
            name="RoomDisplayTwo001_68"
            geometry={nodes.RoomDisplayTwo001_68.geometry}
            material={materials['PaletteMaterial010.015']}
          />
          <mesh
            name="RoomDisplayTwo001_69"
            geometry={nodes.RoomDisplayTwo001_69.geometry}
            material={materials['Chrome_2.007']}
          />
          <mesh
            name="RoomDisplayTwo001_70"
            geometry={nodes.RoomDisplayTwo001_70.geometry}
            material={materials['forMayaAOrear_lights.007']}
          />
          <mesh
            name="RoomDisplayTwo001_71"
            geometry={nodes.RoomDisplayTwo001_71.geometry}
            material={materials['PaletteMaterial011.007']}
          />
          <mesh
            name="RoomDisplayTwo001_72"
            geometry={nodes.RoomDisplayTwo001_72.geometry}
            material={materials['material.038']}
          />
          <mesh
            name="RoomDisplayTwo001_73"
            geometry={nodes.RoomDisplayTwo001_73.geometry}
            material={materials['PaletteMaterial001.129']}
          />
          <mesh
            name="RoomDisplayTwo001_74"
            geometry={nodes.RoomDisplayTwo001_74.geometry}
            material={materials['Tassels.007']}
          />
          <mesh
            name="RoomDisplayTwo001_75"
            geometry={nodes.RoomDisplayTwo001_75.geometry}
            material={materials['PaletteMaterial001.130']}
          />
          <mesh
            name="RoomDisplayTwo001_76"
            geometry={nodes.RoomDisplayTwo001_76.geometry}
            material={materials['Material.081']}
          />
          <mesh
            name="RoomDisplayTwo001_77"
            geometry={nodes.RoomDisplayTwo001_77.geometry}
            material={materials['Glass.015']}
          />
          <mesh
            name="RoomDisplayTwo001_78"
            geometry={nodes.RoomDisplayTwo001_78.geometry}
            material={materials['PaletteMaterial001.131']}
          />
          <mesh
            name="RoomDisplayTwo001_79"
            geometry={nodes.RoomDisplayTwo001_79.geometry}
            material={materials['PaletteMaterial002.068']}
          />
          <mesh
            name="RoomDisplayTwo001_80"
            geometry={nodes.RoomDisplayTwo001_80.geometry}
            material={materials['SVGMat.008']}
          />
          <mesh
            name="RoomDisplayTwo001_81"
            geometry={nodes.RoomDisplayTwo001_81.geometry}
            material={materials['Material.082']}
          />
          <mesh
            name="RoomDisplayTwo001_82"
            geometry={nodes.RoomDisplayTwo001_82.geometry}
            material={materials['default.008']}
          />
          <mesh
            name="RoomDisplayTwo001_83"
            geometry={nodes.RoomDisplayTwo001_83.geometry}
            material={materials['PaletteMaterial012.007']}
          />
          <mesh
            name="RoomDisplayTwo001_84"
            geometry={nodes.RoomDisplayTwo001_84.geometry}
            material={materials['equalizer.012']}
          />
          <mesh
            name="RoomDisplayTwo001_85"
            geometry={nodes.RoomDisplayTwo001_85.geometry}
            material={materials['material_0.016']}
          />
          <mesh
            name="RoomDisplayTwo001_86"
            geometry={nodes.RoomDisplayTwo001_86.geometry}
            material={materials['PaletteMaterial008.022']}
          />
          <mesh
            name="RoomDisplayTwo001_87"
            geometry={nodes.RoomDisplayTwo001_87.geometry}
            material={materials['PaletteMaterial009.015']}
          />
          <mesh
            name="RoomDisplayTwo001_88"
            geometry={nodes.RoomDisplayTwo001_88.geometry}
            material={materials['blackFabric.013']}
          />
          <mesh
            name="RoomDisplayTwo001_89"
            geometry={nodes.RoomDisplayTwo001_89.geometry}
            material={materials['frontColor.012']}
          />
          <mesh
            name="RoomDisplayTwo001_90"
            geometry={nodes.RoomDisplayTwo001_90.geometry}
            material={materials['blackInternal.013']}
          />
          <mesh
            name="RoomDisplayTwo001_91"
            geometry={nodes.RoomDisplayTwo001_91.geometry}
            material={materials['Skin.007']}
          />
          <mesh
            name="RoomDisplayTwo001_92"
            geometry={nodes.RoomDisplayTwo001_92.geometry}
            material={materials['PaletteMaterial001.132']}
          />
          <mesh
            name="RoomDisplayTwo001_93"
            geometry={nodes.RoomDisplayTwo001_93.geometry}
            material={materials['Eyes.007']}
          />
          <mesh
            name="RoomDisplayTwo001_94"
            geometry={nodes.RoomDisplayTwo001_94.geometry}
            material={materials['CH_NPC_Pig_MI_PJH.008']}
          />
          <mesh
            name="RoomDisplayTwo001_95"
            geometry={nodes.RoomDisplayTwo001_95.geometry}
            material={materials['PaletteMaterial001.133']}
          />
          <mesh
            name="RoomDisplayTwo001_96"
            geometry={nodes.RoomDisplayTwo001_96.geometry}
            material={materials['PaletteMaterial004.037']}
          />
        </group>

        <group position={[1, 1.75, 0]}>
          <group
            name="Carnegiea_gigantea_HD_Cactus_spines_01_0002"
            position={[-3.383, 4.814, -3.581]}
            rotation={[-Math.PI / 2, 0, -1.85]}
            scale={[0.163, 0.207, 0.159]}
          >
            <mesh
              name="Carnegiea_gigantea_HD_Cactus_spines_01_0001"
              geometry={
                nodes.Carnegiea_gigantea_HD_Cactus_spines_01_0001.geometry
              }
              material={materials['Cactus_spines_01.004']}
            />
            <mesh
              name="Carnegiea_gigantea_HD_Cactus_spines_01_0001_1"
              geometry={
                nodes.Carnegiea_gigantea_HD_Cactus_spines_01_0001_1.geometry
              }
              material={materials['Carnegiea_bark_01.005']}
            />
            <mesh
              name="Carnegiea_gigantea_HD_Cactus_spines_01_0001_2"
              geometry={
                nodes.Carnegiea_gigantea_HD_Cactus_spines_01_0001_2.geometry
              }
              material={materials['Carnegiea_bark_03.005']}
            />
            <mesh
              name="Carnegiea_gigantea_HD_Cactus_spines_01_0001_3"
              geometry={
                nodes.Carnegiea_gigantea_HD_Cactus_spines_01_0001_3.geometry
              }
              material={materials['Carnegiea_petal_01.004']}
            />
            <mesh
              name="Carnegiea_gigantea_HD_Cactus_spines_01_0001_4"
              geometry={
                nodes.Carnegiea_gigantea_HD_Cactus_spines_01_0001_4.geometry
              }
              material={materials['Carnegiea_petal_02.004']}
            />
            <mesh
              name="Carnegiea_gigantea_HD_Cactus_spines_01_0001_5"
              geometry={
                nodes.Carnegiea_gigantea_HD_Cactus_spines_01_0001_5.geometry
              }
              material={materials['Carnegiea_petal_03.004']}
            />
            <mesh
              name="Carnegiea_gigantea_HD_Cactus_spines_01_0001_6"
              geometry={
                nodes.Carnegiea_gigantea_HD_Cactus_spines_01_0001_6.geometry
              }
              material={materials['Carnegiea_sepal_01.004']}
            />
            <mesh
              name="Carnegiea_gigantea_HD_Cactus_spines_01_0001_7"
              geometry={
                nodes.Carnegiea_gigantea_HD_Cactus_spines_01_0001_7.geometry
              }
              material={materials['Carnegiea_stigma.004']}
            />
            <mesh
              name="Carnegiea_gigantea_HD_Cactus_spines_01_0001_8"
              geometry={
                nodes.Carnegiea_gigantea_HD_Cactus_spines_01_0001_8.geometry
              }
              material={materials['Carnegiea_flower_stalk.005']}
            />
            <mesh
              name="Carnegiea_gigantea_HD_Cactus_spines_01_0001_9"
              geometry={
                nodes.Carnegiea_gigantea_HD_Cactus_spines_01_0001_9.geometry
              }
              material={materials['Carnegiea_stamens.004']}
            />
          </group>

          <mesh
            name="gravel_inside_0004"
            geometry={nodes.gravel_inside_0004.geometry}
            material={materials['inside.005']}
            position={[-3.375, 4.728, -3.534]}
            rotation={[-1.064, 0.476, -2.15]}
            scale={0.153}
          />
          <group
            name="ring_low_robot_2_0002"
            position={[-3.365, 4.511, -3.521]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={0.27}
          >
            <mesh
              name="ring_low_robot_2_0001"
              geometry={nodes.ring_low_robot_2_0001.geometry}
              material={materials['robot_2.005']}
            />
            <mesh
              name="ring_low_robot_2_0001_1"
              geometry={nodes.ring_low_robot_2_0001_1.geometry}
              material={materials['robot_1.005']}
            />
          </group>

          <mesh
            name="GlassBubble002"
            geometry={nodes.GlassBubble002.geometry}
            material={materials['glass.005']}
            position={[-3.385, 4.815, -3.536]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={0.172}
          />
        </group>
      </group>
    </group>
  );
}

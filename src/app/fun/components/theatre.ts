// src/theatre.ts
import { getProject } from '@theatre/core';
import studio from '@theatre/studio';

// Initialize Theatre.js Studio (opens the Studio GUI in development)
studio.initialize();

// Create or get a Project
const project = getProject('Arcade Project', { state: null });

// Create or get a Sheet
const sheet = project.sheet('Arcade Sheet') as any; // Cast to 'any' to access 'actor' and 'sequence'

// Define an Actor for the camera's position and rotation
const cameraActor = sheet.actor('Camera', {
  position: {
    x: 0,
    y: 5,
    z: 10,
  },
  rotation: {
    x: 0,
    y: 0,
    z: 0,
  },
}) as any; // Cast to 'any' to bypass TypeScript errors

// Define a Timeline for camera animation
const cameraSequence = sheet.sequence('Camera Animation', {
  speed: 1,
  loop: false,
}) as any; // Cast to 'any' to bypass TypeScript errors

// Add keyframes to the sequence
cameraSequence
  .add(cameraActor.position.x, 0, { duration: 3 })
  .add(cameraActor.position.y, 2, { duration: 3 })
  .add(cameraActor.position.z, 5, { duration: 3 });

// Export the necessary Theatre.js entities
export { project, sheet, cameraActor, cameraSequence };

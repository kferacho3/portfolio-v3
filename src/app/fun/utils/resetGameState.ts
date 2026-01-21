import type { GameId } from '../store/types';
import { dropperState } from '../games/dropper';
import { reactPongState } from '../games/reactpong';
import { spinBlockState } from '../games/spinblock';
import { stackzState } from '../games/stackz';
import { sizrState } from '../games/sizr';
import { shapeShifterState } from '../games/shapeshifter';
import { skyBlitzState } from '../games/skyblitz';
import { fluxHopState } from '../games/fluxhop';
import { gyroState } from '../games/gyro';
import { prismState } from '../games/prism';
import { formaState } from '../games/forma';
import { weaveState } from '../games/weave';
import { paveState } from '../games/pave';
import { voidRunnerState } from '../games/voidrunner';
import { gravityRushState } from '../games/gravityrush';
import { apexState } from '../games/apex';
import { polarityState } from '../games/polarity';
import { tetherDriftState } from '../games/tetherdrift';
import { traceState } from '../games/trace';
import { flipBoxState } from '../games/flipbox';
import { portalPunchState } from '../games/portalpunch';
import { conveyorChaosState } from '../games/conveyorchaos';
import { rolletteClassicState } from '../games/rolletteClassic';
import { skyBlitzClassicState } from '../games/skyblitzClassic';
import { dropperClassicState } from '../games/dropperClassic';
import { stackzCatchClassicState } from '../games/stackzCatchClassic';

export function resetGameState(gameId: GameId): void {
  switch (gameId) {
    case 'spinblock':
      spinBlockState.reset();
      return;
    case 'reactpong':
      if (reactPongState.mode === 'WallMode') {
        reactPongState.resetWallMode();
      } else {
        reactPongState.reset();
      }
      return;
    case 'skyblitz':
      skyBlitzState.reset();
      return;
    case 'dropper':
      dropperState.reset();
      return;
    case 'stackz':
      stackzState.reset();
      return;
    case 'sizr':
      sizrState.reset();
      return;
    case 'shapeshifter':
      shapeShifterState.reset();
      return;
    case 'fluxhop':
      fluxHopState.reset();
      return;
    case 'gyro':
      gyroState.reset();
      return;
    case 'prism':
      prismState.reset();
      return;
    case 'forma':
      formaState.reset();
      return;
    case 'weave':
      weaveState.reset();
      return;
    case 'pave':
      paveState.reset();
      return;
    case 'voidrunner':
      voidRunnerState.reset();
      return;
    case 'gravityrush':
      gravityRushState.reset();
      return;
    case 'apex':
      apexState.reset();
      return;
    case 'polarity':
      polarityState.reset();
      return;
    case 'tetherdrift':
      tetherDriftState.reset();
      return;
    case 'trace':
      traceState.reset();
      return;
    case 'flipbox':
      flipBoxState.reset();
      return;
    case 'portalpunch':
      portalPunchState.reset();
      return;
    case 'conveyorchaos':
      conveyorChaosState.reset();
      return;
    case 'rolletteClassic':
      rolletteClassicState.reset();
      return;
    case 'skyblitzClassic':
      skyBlitzClassicState.reset();
      return;
    case 'dropperClassic':
      dropperClassicState.reset();
      return;
    case 'stackzCatchClassic':
      stackzCatchClassicState.reset();
      return;
  }
}

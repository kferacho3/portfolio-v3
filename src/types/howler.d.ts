declare module 'howler' {
  export interface HowlOptions {
    src: string[];
    volume?: number;
    loop?: boolean;
    preload?: boolean;
    onloaderror?: (id: number, error: unknown) => void;
  }

  export class Howl {
    constructor(options: HowlOptions);
    play(id?: number | string): number;
    stop(id?: number): this;
    pause(id?: number): this;
    unload(): void;
    volume(value?: number, id?: number): number;
    rate(value?: number, id?: number): number;
    playing(id?: number): boolean;
  }

  export const Howler: {
    ctx?: AudioContext;
  };
}

// src/components/myRoom/AudioControlButton.tsx
import { useEffect, useRef, useState } from 'react';

interface AudioControlButtonProps {
  url: string;
}

const AudioControlButton = ({ url }: AudioControlButtonProps) => {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(new Audio(url));

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio.pause();
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  };

  return <button onClick={togglePlay}>{playing ? 'Pause' : 'Play'}</button>;
};

export default AudioControlButton;

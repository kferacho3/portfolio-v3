import React from 'react';
import { GlobalStyle, Preloader, Ring, Sector } from './PreloaderElements';

const LoadingAnimation = () => {
    const text = "Loading...";
    const rings = 2;
    const ringSectors = 30;
  
    return (
      <>
        <GlobalStyle />
        <Preloader>
          {[...Array(rings)].map((_, r) => (
            <Ring key={r} animDuration={`${8 / rings}s`}>
              {[...Array(ringSectors)].map((_, s) => (
                <Sector key={s} angle={(360 / ringSectors) * s} radius="7rem">
                  {text[s] || ""}
                </Sector>
              ))}
            </Ring>
          ))}
        </Preloader>
      </>
    );
  };
  
  export default LoadingAnimation;
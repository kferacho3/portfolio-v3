import styled, { createGlobalStyle, keyframes } from 'styled-components';

// Keyframes
export const tiltSpin = keyframes`
  from {
    transform: rotateY(0) rotateX(30deg);
  }
  to {
    transform: rotateY(1turn) rotateX(30deg);
  }
`;

export const spin = keyframes`
  from {
    transform: rotateY(0);
  }
  to {
    transform: rotateY(1turn);
  }
`;

// Global Styles (Could use createGlobalStyle from styled-components for body and * selectors)
export const GlobalStyle = createGlobalStyle`
  *, *::before, *::after {
    border: 0;
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  
  :root {
    font-size: calc(16px + (24 - 16) * (100vw - 320px) / (1280 - 320));
  }

  body {
    background: #000;
    color: #3df1f1;
    font: 1em Dosis, sans-serif;
    height: 100vh;
    width: 100vw;
    z-index: 999999999;
    line-height: 1.5;
    perspective: 40em;
    display: flex;
  }
`;

export const Preloader = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  margin: auto;
  width: 17em;
  height: 17em;
  animation: ${tiltSpin} 8s linear infinite;
  transform-style: preserve-3d;
`;

export const Ring = styled.div`
  transform-style: preserve-3d;
  animation: ${spin} ${props => props.animDuration || '4s'} linear infinite;
  font-size: 2em;
  position: relative;
  height: 3rem;
  width: 1.5rem;

  &:nth-child(even) {
    animation-direction: reverse;
  }
`;

export const Sector = styled.div`
  font-weight: 600;
  position: absolute;
  top: 0;
  left: 0;
  text-align: center;
  text-transform: uppercase;
  transform: ${props => `rotateY(${props.angle}deg) translateZ(${props.radius || '7rem'})`};
  display: inline-block;
  width: 100%;
  height: 100%;

  &:empty::before {
    background: linear-gradient(transparent 45%, currentColor 45% 55%, transparent 55%);
    content: "";
    display: inline-block;
    width: 100%;
    height: 100%;
  }
`;

// JSX Component


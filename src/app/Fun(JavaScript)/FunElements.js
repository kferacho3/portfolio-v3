import { motion } from 'framer-motion';
import styled from 'styled-components';


///Fun Elements 

export const CarouselContainer = styled(motion.div)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: absolute;
  left: 0%;
  top: 50%;
  z-index: 1;
  max-width: 375px;
  transform: translateY(-50%);
 // background-color: red;
  border-radius: 50px;
  margin-left: 2.5%;
  text-shadow: 1px 1px 0 #000;
  background-image: radial-gradient(
    circle farthest-corner at 10% 20%,
    rgba(222, 168, 248, 1) 0%,
    rgba(168, 222, 258, 1) 21.9%,
    rgba(189, 250, 205, 1) 35.6%,
    rgba(243, 250, 189, 1) 53.9%,
    rgba(250, 227, 189, 1) 66.8%,
    rgba(248, 172, 171, 1) 95%,
    rgba(254, 170, 212, 1) 99.9%
  );
`;

// Add this to your existing styles for additional customization
export const CarouselButton = styled(motion.button)`
  background: none;
  border: none;
  cursor: pointer;
  padding: 10px;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: transform 0.2s;
    min-height: 50px;
    max-width: 50px;
  &:hover {
    transform: scale(1.1);
  }

  img {
    width: 20px; // Adjust based on your icon size
    height: 20px; // Adjust based on your icon size
  }
`;


export const GameInfo = styled(motion.div)`
  color: #fff;
  padding: 20px;
  max-width: 300px;
`;

export const GameTitle = styled(motion.h3)`
  font-size: 1.2em;
  text-transform: uppercase;
  margin-bottom: 10px;
  white-space: nowrap;
`;

export const GameDetail = styled(motion.p)`
  font-size: 0.8em;
  margin: 15px 0;
  span {
    font-size: 1.1em;
    font-weight: bold;
    margin-right: 5px; // Add space between the span and the text
  }
`;




 export const P5Container = styled.canvas`

 display: flex;
   justify-self: start;
   align-items: center;
   margin-right: auto;
   margin-left: auto;
  margin: 0 auto; 
   width: 100vw!important;
   height: 100vh!important;
 left: 50%;
 right: 0;
 transform: translate(-50%, -50%) !important;

   z-index: 10000000;
   border-radius: 20px;
   cursor: pointer;
   position: relative;
   user-select: none;
   pointer-events: all;



`
export const FunContainer = styled(motion.div)`
    
    position: absolute;
   // z-index: 1;
    height: auto;
    width: 100vw;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: all;
    overflow: scroll;
    
    :before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0, 0, 0, 0, 0.6) 100%), 
        linear-gradient(180deg, rgba(0,0,0,0.2) 0%, transparent 100%)
        

    }
    
 
`;
export const FunImg = styled.div`
    background-image: url('./images/arcade.png');
    background-position: center;
    background-size: cover;
    display:flex;
    justify-self: start;
    align-items: center;
    margin-right: auto;
    margin-left: auto;
    margin: 0 auto;
    max-width: 100%;
    width: 100%!important;
    height: 320vh !important;
    pointer-events: none;
    position:absolute;
    content:''; 
    z-index: 100000000;

    @media screen and (max-width: 420px)  {
        zoom: 0.6;
        transform: translateY(-100px);
    }
  
`;


export const FunBG = styled.div`
    position: absolute;
    top: 0;
    right: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    
    
`;

export const VideoBg = styled.img`
    width: 100%;
    height: 100%;
    z-index: -9999px;
    -o-object-fit: cover;
    object-fit: cover;
    
`;

export const FunContent = styled.div`
    z-index: 3;
    max-width: 1200px;
    position: absolute;
    padding: 8px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;

`;

export const FunH1 = styled.h1`
    color: #FFF444;
    font-size: 8rem;
    position: absolute;
    top: 50%;
    left: 50%;
    margin-right: -50%;
    transform: translate(-60%, -250%);
    text-shadow: 5px 5px #FF0000;
    z-index: 99999;
    text-align: center;

@media screen and (max-width: 1250px) {
    font-size: 6rem;
}

@media screen and (max-width: 850px) {
        font-size: 3.5rem;

    transform: translate(-50%, -200%);
    }
`;





//Roller Elements




export const HUDContainer = styled.div`
  position: absolute;
  top: 20px;
  left: 20px;
  color: white;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  z-index: 100;
`;

export const ScoreDisplay = styled.div`
  font-size: 24px;
  font-weight: bold;
  color: #FFD700; // Gold color
  text-shadow: 0 0 10px rgba(0,0,0,0.8);
`;

export const HealthDisplay = styled.div`
  font-size: 24px;
  font-weight: bold;
  text-shadow: 0 0 5px #000;
  color: ${({ health }) => getHealthColor(health)}; // Color based on health
`;

// Function to determine health color
const getHealthColor = (health) => {
    if (health > 66) return '#00FF00';
    else if (health > 33) return '#FFFF00';
    else return '#FF0000';
  };

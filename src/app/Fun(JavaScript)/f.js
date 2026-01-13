import React, { useState } from 'react';
import Navbar from '../../components/Navbar/Navbar';
import Sidebar from '../../components/Sidebar';
import Fun from './Fun';


const Fff = ({isArcade, setIsArcade}) => {
    const [isOpen, setIsOpen] = useState(false)
    const [isOpen2, setIsOpen2] = useState(false)
    const toggle = () => {
        setIsOpen(!isOpen)
    }
    const toggle2 = () => {
      setIsOpen2(!isOpen2)
  }
   // const [isArcade, setIsArcade] = useState(true);
    const [gameIconState, setGameIconState] = useState(false);
    const [gameState, setGameState] = useState(10);
    return (
      <>
          <>
            <>
            <Sidebar isOpen={isOpen} toggle={toggle} />
            <Navbar setGameState={setGameState} isOpen2={isOpen2} setIsOpen2={setIsOpen2} toggle2={toggle2} gameIconState={gameIconState} isArcade={isArcade} toggle={toggle}/>
            <Fun gameState={gameState}  setGameState={setGameState} isOpen2={isOpen2} setGameIconState={setGameIconState} setIsArcade={setIsArcade}/>
            
           </>
          </>
        
      </>
    );
  }
  
  export default Fff;
  
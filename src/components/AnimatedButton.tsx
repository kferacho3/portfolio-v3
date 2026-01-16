// components/AnimatedButton.tsx

import { HTMLMotionProps, motion } from 'framer-motion';
import React, { FC } from 'react';

interface AnimatedButtonProps extends HTMLMotionProps<'button'> {
  children: React.ReactNode;
  className?: string;
}

const AnimatedButton: FC<AnimatedButtonProps> = ({
  children,
  className = '',
  disabled = false,
  ...props
}) => {
  const colors = ['#39FF14', '#FFA500', '#9400D3']; // Neon green, orange, purple

  return (
    <motion.button
      type={props.type || 'button'}
      className={`inline-flex items-center px-6 py-3 border-2 border-current rounded-full text-current ${className}`}
      whileHover={{
        backgroundColor: colors[Math.floor(Math.random() * colors.length)],
        color: '#000',
        borderColor: 'transparent', // Remove border on hover
      }}
      transition={{ duration: 0.3 }}
      disabled={disabled}
      {...props}
    >
      {children}
    </motion.button>
  );
};

export default AnimatedButton;

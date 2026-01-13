// components/AnimatedLink.tsx

import { motion } from 'framer-motion';
import React from 'react';

interface AnimatedLinkProps {
  text?: string;
  icon?: React.ReactNode;
  link?: string;
  onClick?: () => void;
  className?: string;
}

const AnimatedLink: React.FC<AnimatedLinkProps> = ({
  text,
  icon,
  link,
  onClick,
  className,
}) => {
  const colors = ['#39FF14', '#FFA500', '#9400D3', '#FF1493', '#FFFF00']; // Neon green, orange, purple, pink, yellow
  const isExternal =
    !!link &&
    (link.startsWith('http') || link.startsWith('mailto:') || link.startsWith('tel:'));

  return (
    <motion.a
      href={link}
      onClick={onClick}
      className={`inline-flex items-center px-6 py-3 border-2 border-current rounded-full text-current ${className}`}
      whileHover={{
        backgroundColor: colors[Math.floor(Math.random() * colors.length)],
        color: '#000',
        borderColor: 'transparent', // Remove border on hover
      }}
      transition={{ duration: 0.3 }}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {text}
    </motion.a>
  );
};

export default AnimatedLink;

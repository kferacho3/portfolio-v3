/**
 * Fun Layout
 * 
 * Shared layout for all /fun routes.
 * Provides the arcade context and canvas wrapper.
 */
import React from 'react';

export default function FunLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen w-screen overflow-hidden bg-black">
      {children}
    </div>
  );
}

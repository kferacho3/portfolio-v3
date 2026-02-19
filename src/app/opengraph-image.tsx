import { ImageResponse } from 'next/og';

export const alt = 'Kamal Feracho Portfolio';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 64px',
          background:
            'radial-gradient(circle at 20% 20%, #181d3a 0%, #080a15 55%, #03040a 100%)',
          color: '#ffffff',
          fontFamily: 'ui-sans-serif, system-ui',
        }}
      >
        <div
          style={{
            fontSize: 24,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: '#9CA3AF',
          }}
        >
          Kamal Feracho
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05 }}>
            Full-Stack Engineer
          </div>
          <div style={{ fontSize: 34, color: '#D1D5DB' }}>
            Product UI Systems • API Integrations • Interactive 3D
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 28,
            fontWeight: 600,
            color: '#A7F3D0',
          }}
        >
          rachodevs.com
        </div>
      </div>
    ),
    size
  );
}

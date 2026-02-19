import { ImageResponse } from 'next/og';

export const alt = 'Kamal Feracho Portfolio';
export const size = {
  width: 1200,
  height: 675,
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
            'linear-gradient(125deg, #0f172a 0%, #111827 45%, #052e2b 100%)',
          color: '#ffffff',
          fontFamily: 'ui-sans-serif, system-ui',
        }}
      >
        <div
          style={{
            fontSize: 22,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: '#94A3B8',
          }}
        >
          Portfolio
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 66, fontWeight: 800, lineHeight: 1.06 }}>
            Kamal Feracho
          </div>
          <div style={{ fontSize: 34, color: '#E5E7EB' }}>
            Full-Stack Engineer
          </div>
          <div style={{ fontSize: 30, color: '#86EFAC' }}>
            Case Studies • UI Architecture • 3D Web
          </div>
        </div>
        <div style={{ fontSize: 26, color: '#C4B5FD' }}>rachodevs.com</div>
      </div>
    ),
    size
  );
}

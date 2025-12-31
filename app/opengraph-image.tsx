import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = "Poor Man's Loom — Screen Recording";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.02\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          fontFamily: 'system-ui, -apple-system',
        }}
      >
        {/* Main container with border */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            padding: '80px',
            border: '1px solid #262626',
          }}
        >
          {/* Title */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '24px',
            }}
          >
            <div
              style={{
                fontSize: '96px',
                fontWeight: '700',
                color: '#fafafa',
                letterSpacing: '-0.02em',
                textAlign: 'center',
                lineHeight: '1.1',
              }}
            >
              Poor Man's Loom
            </div>
            
            {/* Subtitle */}
            <div
              style={{
                fontSize: '32px',
                color: '#737373',
                fontWeight: '400',
                textAlign: 'center',
                fontFamily: 'monospace',
                letterSpacing: '0.05em',
              }}
            >
              Screen Recording · Edit · Export
            </div>
            
            {/* Feature badges */}
            <div
              style={{
                display: 'flex',
                gap: '16px',
                marginTop: '40px',
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#171717',
                  border: '1px solid #262626',
                  borderRadius: '4px',
                  fontSize: '20px',
                  color: '#fafafa',
                  fontFamily: 'monospace',
                }}
              >
                ✓ Free
              </div>
              <div
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#171717',
                  border: '1px solid #262626',
                  borderRadius: '4px',
                  fontSize: '20px',
                  color: '#fafafa',
                  fontFamily: 'monospace',
                }}
              >
                ✓ Local
              </div>
              <div
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#171717',
                  border: '1px solid #262626',
                  borderRadius: '4px',
                  fontSize: '20px',
                  color: '#fafafa',
                  fontFamily: 'monospace',
                }}
              >
                ✓ No Signup
              </div>
            </div>
          </div>
          
          {/* Bottom tagline */}
          <div
            style={{
              position: 'absolute',
              bottom: '60px',
              fontSize: '18px',
              color: '#525252',
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
            }}
          >
            All in your browser
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}


import React from 'react';

interface WatermarkProps {
  text: string;
}

/**
 * 全屏水印组件 — 在页面上覆盖一层淡色、旋转的用户名文字水印
 * 防止截图/拍照泄露信息时无法追溯
 */
const Watermark: React.FC<WatermarkProps> = ({ text }) => {
  if (!text) return null;

  return (
    <div
      id="hrm-watermark"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 99999,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-50%',
          left: '-50%',
          width: '200%',
          height: '200%',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, 260px)',
          gridTemplateRows: 'repeat(auto-fill, 160px)',
          transform: 'rotate(-25deg)',
          gap: '40px 20px',
        }}
      >
        {Array.from({ length: 100 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 500,
              color: 'rgba(0,0,0,0.04)',
              userSelect: 'none',
              whiteSpace: 'nowrap',
              letterSpacing: '2px',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {text}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Watermark;

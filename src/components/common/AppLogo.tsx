import React from 'react';

interface AppLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  withGlow?: boolean;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  size = 'lg',
  className = '',
  withGlow = true,
}) => {
  // Dimension mappings tuned for harmonious proportions
  const dimensions = {
    xs: { box: 'w-7 h-7', svg: 28, radius: 'rounded-[10px]' },
    sm: { box: 'w-9 h-9', svg: 36, radius: 'rounded-[13px]' },
    md: { box: 'w-11 h-11', svg: 44, radius: 'rounded-[16px]' },
    lg: { box: 'w-16 h-16', svg: 64, radius: 'rounded-[22px]' },
    xl: { box: 'w-20 h-20', svg: 80, radius: 'rounded-[26px]' },
  }[size];

  return (
    <div className={`relative flex items-center justify-center shrink-0 select-none ${className}`}>
      {/* Ambient Chroma Aura */}
      {withGlow && (
        <div
          className={`absolute -inset-2 ${dimensions.radius} bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 blur-xl opacity-60 -z-10 animate-pulse pointer-events-none`}
          style={{ animationDuration: '3.5s' }}
        />
      )}

      {/* Main App Icon Chassis */}
      <div
        className={`${dimensions.box} ${dimensions.radius} relative overflow-hidden bg-gradient-to-b from-[#0B0F19] via-[#070A12] to-[#030408] p-1 shadow-[0_12px_36px_-6px_rgba(2,132,199,0.45),0_6px_20px_rgba(0,0,0,0.9)] flex items-center justify-center group transition-all duration-300 hover:scale-105 active:scale-95`}
      >
        {/* Subtle rounded border bezel */}
        <div className="absolute inset-0 rounded-[inherit] p-[1.2px] bg-gradient-to-b from-cyan-400/40 via-blue-500/20 to-transparent pointer-events-none" />

        {/* Inner glow and specular highlights */}
        <div className="absolute inset-0 rounded-[inherit] overflow-hidden pointer-events-none">
          {/* Top subtle gloss */}
          <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.12] to-transparent" />
          {/* Bottom neon blue reflection glow */}
          <div className="absolute -bottom-4 inset-x-4 h-8 bg-cyan-400/30 blur-md rounded-full" />
        </div>

        {/* PayBack 3D "P" + Green Coin Stack + Return Arrow Vector Emblem */}
        <svg
          width={dimensions.svg}
          height={dimensions.svg}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10 drop-shadow-[0_4px_12px_rgba(0,0,0,0.7)] transition-transform duration-300 group-hover:scale-105"
        >
          <defs>
            {/* Main 3D Blue "P" Body Gradient */}
            <linearGradient id="pbPBodyGrad" x1="20" y1="12" x2="86" y2="80" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#00A2FF" />
              <stop offset="35%" stopColor="#0077F5" />
              <stop offset="70%" stopColor="#0052CC" />
              <stop offset="100%" stopColor="#0A2A7A" />
            </linearGradient>

            {/* "P" Outer Rim Highlight Gradient */}
            <linearGradient id="pbPRimGrad" x1="24" y1="12" x2="86" y2="60" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#67E8F9" />
              <stop offset="50%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>

            {/* White/Silver 3D Return Arrow Gradient */}
            <linearGradient id="pbArrowGrad" x1="40" y1="20" x2="78" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="60%" stopColor="#F8FAFC" />
              <stop offset="100%" stopColor="#E2E8F0" />
            </linearGradient>

            {/* Green Coin Top Face Gradient */}
            <linearGradient id="pbCoinTopGrad" x1="41" y1="36" x2="60" y2="45" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#86EFAC" />
              <stop offset="40%" stopColor="#4ADE80" />
              <stop offset="100%" stopColor="#22C55E" />
            </linearGradient>

            {/* Green Coin 1 Side Gradient */}
            <linearGradient id="pbCoinSide1" x1="41" y1="41" x2="60" y2="47" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#22C55E" />
              <stop offset="50%" stopColor="#16A34A" />
              <stop offset="100%" stopColor="#15803D" />
            </linearGradient>

            {/* Green Coin 2 Side Gradient */}
            <linearGradient id="pbCoinSide2" x1="41" y1="47" x2="60" y2="54" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#16A34A" />
              <stop offset="50%" stopColor="#15803D" />
              <stop offset="100%" stopColor="#14532D" />
            </linearGradient>

            {/* Lower-left Green Leaf Shard Gradient */}
            <linearGradient id="pbGreenLeaf" x1="24" y1="48" x2="40" y2="84" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#4ADE80" />
              <stop offset="40%" stopColor="#22C55E" />
              <stop offset="80%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>

            {/* Specular Glass Sheen Gradient */}
            <linearGradient id="pbGlassSheen" x1="24" y1="12" x2="60" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
              <stop offset="35%" stopColor="#FFFFFF" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>

            {/* Soft Arrow Cast Shadow */}
            <filter id="pbArrowShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="-1.5" dy="3.5" stdDeviation="2.5" floodColor="#021438" floodOpacity="0.75" />
            </filter>

            {/* Coin Stack Shadow */}
            <filter id="pbCoinShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="1" dy="3" stdDeviation="2" floodColor="#021438" floodOpacity="0.6" />
            </filter>

            {/* Floor Glow Blur */}
            <filter id="pbFloorGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.5" />
            </filter>
          </defs>

          {/* 1. Ambient Floor Cyan Under-Glow */}
          <ellipse cx="36" cy="86" rx="20" ry="3.5" fill="#00E5FF" filter="url(#pbFloorGlow)" opacity="0.8" />

          {/* 2. Main 3D Blue "P" Body Silhouette */}
          <path
            d="M 24 26 C 24 18 30 12 38 12 L 60 12 C 75 12 85 22 85 38 C 85 53 74 64 58 64 C 52 64 48 68 46 73 L 42 79 C 39 85 32 87 26 84 C 24 83 24 79 24 75 Z"
            fill="url(#pbPBodyGrad)"
          />

          {/* 3. Deep 3D Shadow Fold in P bowl */}
          <path
            d="M 48 64 C 58 64 74 58 78 46 C 81 38 78 28 72 20 C 78 27 82 35 82 44 C 82 56 72 65 56 65 L 48 65 Z"
            fill="#021E54"
            opacity="0.6"
          />

          {/* 4. P Outer Translucent Rim / Bevel Stroke */}
          <path
            d="M 24 26 C 24 18 30 12 38 12 L 60 12 C 75 12 85 22 85 38 C 85 53 74 64 58 64"
            stroke="url(#pbPRimGrad)"
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          {/* 5. The Sweeping 3D White Return Arrow */}
          <g filter="url(#pbArrowShadow)">
            {/* Arrow Arc + Arrowhead combo path */}
            <path
              d="M 40 26 L 53 18 L 53 22.8 C 66 22.8 77.5 30 77.5 43.5 C 77.5 52.5 71 59 61 63 C 59.5 63.6 58 62 58 60.5 C 58 59 59 58 60 57.2 C 67 53.5 70.5 48 70.5 42 C 70.5 32 63 28.5 53 28.5 L 53 34 Z"
              fill="url(#pbArrowGrad)"
              stroke="#FFFFFF"
              strokeWidth="0.8"
              strokeLinejoin="round"
            />
            {/* Subtle inner arrow 3D edge */}
            <path
              d="M 41 26 L 52.5 19 L 52.5 23.5"
              stroke="#E2E8F0"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </g>

          {/* 6. Stack of 2 Emerald Green Coins inside the P loop */}
          <g filter="url(#pbCoinShadow)">
            {/* Lower Coin 2 Base & Side */}
            <path
              d="M 41.5 47 L 41.5 53.5 C 41.5 57 59.5 57 59.5 53.5 L 59.5 47 Z"
              fill="url(#pbCoinSide2)"
            />
            <ellipse
              cx="50.5"
              cy="53.5"
              rx="9"
              ry="3.5"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="1.6"
            />
            <ellipse
              cx="50.5"
              cy="47"
              rx="9"
              ry="3.5"
              fill="url(#pbCoinSide2)"
              stroke="#FFFFFF"
              strokeWidth="1.6"
            />

            {/* Upper Coin 1 Base & Side */}
            <path
              d="M 41.5 41 L 41.5 47 C 41.5 50.5 59.5 50.5 59.5 47 L 59.5 41 Z"
              fill="url(#pbCoinSide1)"
            />
            <ellipse
              cx="50.5"
              cy="47"
              rx="9"
              ry="3.5"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="1.6"
            />

            {/* Upper Coin 1 Top Face (tilted cylinder cap) */}
            <ellipse
              cx="50.5"
              cy="41"
              rx="9"
              ry="3.6"
              fill="url(#pbCoinTopGrad)"
              stroke="#FFFFFF"
              strokeWidth="1.6"
            />

            {/* Specular sheen on top coin */}
            <ellipse
              cx="48.5"
              cy="40"
              rx="5.5"
              ry="1.8"
              fill="#FFFFFF"
              opacity="0.45"
            />
          </g>

          {/* 7. Lower-Left Emerald Green Leaf Shard with White Contour */}
          <g>
            <path
              d="M 24.2 46.5 C 24.2 46.5 32 57 39 63 C 40.5 69 39 77 33 82 C 27 85 24.2 81 24.2 76 Z"
              fill="url(#pbGreenLeaf)"
            />
            {/* Crisp white 3D boundary line */}
            <path
              d="M 24.2 46.5 C 28 53 34 60 39 63 C 41.5 70 39.5 78 33 82"
              stroke="#FFFFFF"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
            {/* Inner glossy reflection line on leaf */}
            <path
              d="M 27 52 C 30 57 34 63 36 68"
              stroke="#86EFAC"
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity="0.8"
            />
          </g>

          {/* 8. Top Specular Glass Curve Highlight across P */}
          <path
            d="M 25 24 C 25 18 30 13 37 13 L 57 13 C 68 13 76 18 78 27 C 68 19 50 19 36 29 L 25 38 Z"
            fill="url(#pbGlassSheen)"
          />

          {/* 9. Bottom Tip Cyan Highlight */}
          <path
            d="M 24.5 74 C 24.5 80 27 84 32 83"
            stroke="#00E5FF"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
};

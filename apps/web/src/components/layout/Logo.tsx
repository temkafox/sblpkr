export function Logo() {
  return (
    <header className="logo">
      <div className="mark">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 2 L20 9 L17 22 L7 22 L4 9 Z"
            fill="#1a0028"
            stroke="white"
            strokeWidth="1.2"
          />
          <circle cx="12" cy="13" r="3" fill="white" opacity="0.9" />
        </svg>
      </div>
      <div className="word">
        <div className="l1">
          <span className="l1-neon">NEON</span>
          <span className="l1-poker">POKER</span>
        </div>
        <div className="l2">DESKTOP · NL HOLD&apos;EM</div>
      </div>
    </header>
  );
}

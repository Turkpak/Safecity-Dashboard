import { useEffect, useState } from "react";

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Show splash screen for 1 second
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onComplete();
      }, 300); // Wait for fade out animation
    }, 1000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-background transition-opacity duration-500 ${
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="relative flex items-center justify-center w-48 h-48">
        {/* Outer circular line - Color #101a3c */}
        <svg
          className="absolute top-0 left-0 animate-spin-slow"
          width="192"
          height="192"
          viewBox="0 0 192 192"
        >
          <circle
            cx="96"
            cy="96"
            r="88"
            fill="none"
            stroke="#101a3c"
            strokeWidth="4"
            strokeDasharray="276"
            strokeDashoffset="70"
            strokeLinecap="round"
            opacity="0.9"
          />
        </svg>

        {/* Inner circular line - Color #d9172a */}
        <svg
          className="absolute top-0 left-0 animate-spin-slow-reverse"
          width="160"
          height="160"
          viewBox="0 0 160 160"
          style={{ margin: "16px" }}
        >
          <circle
            cx="80"
            cy="80"
            r="72"
            fill="none"
            stroke="#d9172a"
            strokeWidth="3.5"
            strokeDasharray="226"
            strokeDashoffset="50"
            strokeLinecap="round"
            opacity="0.9"
          />
        </svg>

        {/* Logo */}
        <div className="relative z-10 flex items-center justify-center">
          <img
            src="/Assets/psca.png"
            alt="PSCA Logo"
            className="h-28 w-28 object-contain"
          />
        </div>
      </div>
    </div>
  );
}


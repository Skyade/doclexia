import { useEffect, useRef } from 'react';

/**
 * A custom hook to detect pinch-to-zoom gestures on touch devices
 * and map them to a custom scaling function (e.g. font size).
 */
export function usePinchToResize(onScale: (delta: number) => void) {
  const initialDistance = useRef<number | null>(null);

  useEffect(() => {
    const getDistance = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialDistance.current = getDistance(e.touches);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistance.current !== null) {
        // Prevent browser zoom
        if (e.cancelable) e.preventDefault();
        
        const current = getDistance(e.touches);
        const delta = current - initialDistance.current;
        
        // We only trigger if the change is significant enough to feel deliberate
        if (Math.abs(delta) > 1) {
          onScale(delta * 0.15); // Sensitivity multiplier
          initialDistance.current = current;
        }
      }
    };

    const handleTouchEnd = () => {
      initialDistance.current = null;
    };

    // iOS Safari requires non-passive listeners to prevent default zoom behavior
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Also disable double-tap to zoom on iOS
    let lastTouchTime = 0;
    const handleDoubleTap = (e: TouchEvent) => {
      const now = performance.now();
      if (now - lastTouchTime < 300) {
        if (e.cancelable) e.preventDefault();
      }
      lastTouchTime = now;
    };
    document.addEventListener('touchstart', handleDoubleTap, { passive: false });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchstart', handleDoubleTap);
    };
  }, [onScale]);
}

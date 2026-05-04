import { useEffect, useRef } from 'react';

/**
 * A hardened custom hook to detect pinch-to-zoom gestures on touch devices
 * and map them to a custom scaling function (e.g. font size).
 */
export function usePinchToResize(onScale: (delta: number) => void) {
  const initialDistance = useRef<number | null>(null);

  useEffect(() => {
    // SSR Guard
    if (typeof window === 'undefined') return;

    const getDistance = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        console.log("[Pinch] Gesture started with 2 fingers");
        initialDistance.current = getDistance(e.touches);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistance.current !== null) {
        // Prevent browser zoom (crucial: must be non-passive)
        if (e.cancelable) e.preventDefault();
        
        const current = getDistance(e.touches);
        const delta = current - initialDistance.current;
        
        // We only trigger if the change is significant enough
        if (Math.abs(delta) > 0.5) {
          const scaledDelta = delta * 0.12; // Adjusted sensitivity
          console.log(`[Pinch] Delta: ${delta.toFixed(2)}, Scaling: ${scaledDelta.toFixed(2)}`);
          onScale(scaledDelta);
          initialDistance.current = current;
        }
      }
    };

    const handleTouchEnd = () => {
      if (initialDistance.current !== null) {
        console.log("[Pinch] Gesture ended");
      }
      initialDistance.current = null;
    };

    // iOS Safari Proprietary Gesture Events (Harden against native zoom)
    const handleIOSGesture = (e: any) => {
      if (e.cancelable) e.preventDefault();
      console.log("[Pinch] Blocked native iOS gesture");
    };

    // Add listeners
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    // Hardening for iOS Safari
    document.addEventListener('gesturestart', handleIOSGesture, { passive: false });
    document.addEventListener('gesturechange', handleIOSGesture, { passive: false });

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
      document.removeEventListener('gesturestart', handleIOSGesture);
      document.removeEventListener('gesturechange', handleIOSGesture);
      document.removeEventListener('touchstart', handleDoubleTap);
    };
  }, [onScale]);
}

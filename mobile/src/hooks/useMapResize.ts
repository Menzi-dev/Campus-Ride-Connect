// Map layout: notify the browser map when its container size changes so tiles and controls fit the
// visible area.
// Where: useMapResize(map) in hooks/useMapResize.ts.
// How: Its effect watches layout changes and calls map.invalidateSize() so Leaflet recalculates the
// visible map area.
import { useEffect } from 'react';

/** Leaflet also needs to redraw when its parent changes size without a window resize. */
export default function useMapResize(map: any) {
  useEffect(() => {
    if (!map || typeof ResizeObserver === 'undefined') return;
    let frame: number | undefined;
    const observer = new ResizeObserver(() => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    });
    observer.observe(map.getContainer());
    return () => {
      observer.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [map]);
}

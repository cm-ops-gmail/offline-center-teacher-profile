'use client';
import { useEffect, useRef, useState } from 'react';

const NUMERIC = /^(-?\d+(?:\.\d+)?)(.*)$/;

/**
 * Counts a number up to its value (4.88, 177, 64%…) and re-counts smoothly from the old value when it changes.
 * Anything that is not a plain number is shown as is. Users who prefer reduced motion just see the value.
 */
export function CountUp({ value, duration = 800 }: { value: string | number; duration?: number }) {
  const text = String(value);
  const m = NUMERIC.exec(text);
  const target = m ? Number(m[1]) : NaN;
  const decimals = m ? (m[1].split('.')[1] ?? '').length : 0;
  const suffix = m ? m[2] : '';
  const [shown, setShown] = useState<number>(Number.isNaN(target) ? 0 : 0);
  const from = useRef(0);

  useEffect(() => {
    if (Number.isNaN(target)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      from.current = target;
      setShown(target);
      return;
    }
    const start = performance.now();
    const begin = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out
      const v = begin + (target - begin) * eased;
      from.current = v;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  if (Number.isNaN(target)) return <>{text}</>;
  return (
    <>
      {shown.toFixed(decimals)}
      {suffix}
    </>
  );
}

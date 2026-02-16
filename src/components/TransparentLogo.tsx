"use client";

import { useEffect, useRef, useState } from "react";

const wolandLogoSrc = "/assets/Screenshot_2026-02-14_at_16.55.42_1771088148190.png";

interface TransparentLogoProps {
  className?: string;
  alt?: string;
}

export function TransparentLogo({ className = "", alt = "Woland" }: TransparentLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = (r + g + b) / 3;
        if (brightness > 230) {
          data[i + 3] = 0;
        } else if (brightness > 200) {
          data[i + 3] = Math.round(255 * (1 - (brightness - 200) / 30));
        }
      }
      ctx.putImageData(imageData, 0, 0);
      setDataUrl(canvas.toDataURL("image/png"));
    };
    img.src = wolandLogoSrc;
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="hidden" />
      {dataUrl ? (
        <img src={dataUrl} alt={alt} className={`dark:invert ${className}`} />
      ) : (
        <img src={wolandLogoSrc} alt={alt} className={`dark:invert ${className}`} />
      )}
    </>
  );
}

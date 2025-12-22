"use client";

import { useState } from "react";

interface ProfileImageProps {
  src: string | null;
  alt: string;
  className?: string;
  fallbackSrc?: string;
}

export function ProfileImage({
  src,
  alt,
  className,
  fallbackSrc = "https://via.placeholder.com/150",
}: ProfileImageProps) {
  const [imgSrc, setImgSrc] = useState(src || fallbackSrc);

  const handleError = () => {
    setImgSrc(fallbackSrc);
  };

  return (
    <img src={imgSrc} alt={alt} className={className} onError={handleError} />
  );
}

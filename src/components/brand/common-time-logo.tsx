import Image from "next/image";
import logo from "../../../tmp_logo.png";

export function CommonTimeLogo({ className = "", priority = false, light = false }: { className?: string; priority?: boolean; light?: boolean }) {
  const treatment = light
    ? "brightness-0 invert opacity-95 mix-blend-normal drop-shadow-sm"
    : "brightness-[1.8] contrast-125 saturate-125 mix-blend-screen";
  return <Image src={logo} alt="Common Time for Music Schools" priority={priority} className={`h-auto ${treatment} ${className}`} />;
}

import Image from "next/image";
import logo from "../../../tmp_logo.png";

export function CommonTimeLogo({ className = "", priority = false }: { className?: string; priority?: boolean }) {
  return <Image src={logo} alt="Common Time for Music Schools" priority={priority} className={`h-auto brightness-[1.8] contrast-125 saturate-125 mix-blend-screen ${className}`} />;
}

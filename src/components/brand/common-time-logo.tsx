import Image from "next/image";
import logo from "../../../tmp_logo.png";

export function CommonTimeLogo({ className = "", priority = false }: { className?: string; priority?: boolean }) {
  return <Image src={logo} alt="Common Time for Music Schools" priority={priority} className={`h-auto mix-blend-screen ${className}`} />;
}

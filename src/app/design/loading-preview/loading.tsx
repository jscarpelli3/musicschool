import { CommonTimeLoader } from "@/components/ui/common-time-loader";

export default function LoadingPreviewFallback() {
  return <main className="grid min-h-dvh place-items-center bg-canvas px-5">
    <CommonTimeLoader label="Artificial eight-second loading preview…" />
  </main>;
}

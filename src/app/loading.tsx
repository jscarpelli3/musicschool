import { CommonTimeLoader } from "@/components/ui/common-time-loader";

export default function AppLoading() {
  return <main className="grid min-h-dvh place-items-center bg-canvas px-5">
    <CommonTimeLoader label="Loading page…" />
  </main>;
}

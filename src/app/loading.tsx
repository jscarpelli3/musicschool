import { CommonTimeLoader } from "@/components/ui/common-time-loader";

export default function AppLoading() {
  return <main data-full-page-loading className="fixed inset-0 z-[100] grid min-h-dvh place-items-center overflow-hidden bg-canvas px-5">
    <CommonTimeLoader label="Loading page…" />
  </main>;
}

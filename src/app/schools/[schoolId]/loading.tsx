import { CommonTimeLoader } from "@/components/ui/common-time-loader";

export default function SchoolLoading() {
  return <main data-full-page-loading className="fixed inset-0 z-[100] grid min-h-dvh place-items-center overflow-hidden bg-canvas px-5">
    <CommonTimeLoader label="Getting the next page ready…" />
  </main>;
}

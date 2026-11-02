import { CommonTimeLoader } from "@/components/ui/common-time-loader";

export default function SchoolLoading() {
  return <main className="mx-auto grid min-h-[70dvh] max-w-5xl place-items-center px-5">
    <CommonTimeLoader label="Getting the next page ready…" />
  </main>;
}

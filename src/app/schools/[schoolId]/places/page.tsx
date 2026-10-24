import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PlacesPage({ params }: {
  params: Promise<{ schoolId: string }>;
}) {
  const { schoolId } = await params;
  redirect(`/schools/${schoolId}/products#lesson-places`);
}

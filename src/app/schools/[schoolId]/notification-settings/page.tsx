import {notFound,redirect} from "next/navigation";
import {SetupHeader} from "@/components/school-setup/setup-header";
import {loadMySchoolCapabilities} from "@/lib/auth/school-capabilities";
import {createClient} from "@/lib/supabase/server";
import {PushNotificationSettings} from "./push-notification-settings";
import type {SupabaseClient} from "@supabase/supabase-js";
import Link from "next/link";
import {PageHeading} from "@/components/ui/page-heading";

export const dynamic="force-dynamic";

export default async function NotificationSettingsPage({params}:{params:Promise<{schoolId:string}>}){
 const{schoolId}=await params,supabase=await createClient(),untyped=supabase as unknown as SupabaseClient,{data:auth}=await supabase.auth.getClaims(),profileId=auth?.claims?.sub;
 if(!profileId)redirect(`/login?next=/schools/${schoolId}/notification-settings`);
 const[{data:school},{data:membership},{data:preference},capabilities]=await Promise.all([
  supabase.from("schools").select("name").eq("id",schoolId).maybeSingle(),
  supabase.from("school_members").select("role").eq("school_id",schoolId).eq("profile_id",profileId).eq("status","active").maybeSingle(),
  untyped.from("school_notification_preferences").select("browser_push_enabled,billing_activity,schedule_requests,lesson_updates,daily_hello").eq("school_id",schoolId).eq("profile_id",profileId).maybeSingle(),
  loadMySchoolCapabilities(schoolId),
 ]);
 if(!school||!membership)notFound();
 const header=capabilities.has("school.setup.manage")?<SetupHeader schoolId={schoolId} schoolName={school.name} active="notifications"/>:<header><Link href={`/schools/${schoolId}/notifications`} className="mb-7 inline-flex text-sm text-muted transition-colors hover:text-ink">← Back to notifications</Link><PageHeading kind="notifications" title="Notification settings" description={`Choose how ${school.name} gets your attention.`}/></header>;
 return <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 sm:px-8 sm:py-section">{header}<section className="ui-card mt-6 grid gap-8 p-6 md:grid-cols-[1fr_2fr] md:gap-12 md:p-8"><div><h2 className="font-display text-3xl">Notifications</h2><p className="mt-3 text-sm leading-6 text-muted">Choose how Common Time gets your attention. Browser permission is always controlled separately on each device.</p></div><PushNotificationSettings schoolId={schoolId} vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()??""} initial={{browserPushEnabled:preference?.browser_push_enabled??false,billingActivity:preference?.billing_activity??true,scheduleRequests:preference?.schedule_requests??true,lessonUpdates:preference?.lesson_updates??true,dailyHello:preference?.daily_hello??false}}/></section></main>;
}

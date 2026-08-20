import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NotificationList } from "./notification-list";
export const dynamic="force-dynamic";
export default async function NotificationsPage({params,searchParams}:{params:Promise<{schoolId:string}>;searchParams:Promise<{view?:string}>}){
 const {schoolId}=await params,{view}=await searchParams,archived=view==="archived",supabase=await createClient();
 const {data:school}=await supabase.from("schools").select("name").eq("id",schoolId).maybeSingle();if(!school)notFound();
 let query=supabase.from("owner_notifications").select("id,title,message,href,kind,created_at,read_at,archived_at").eq("school_id",schoolId).order("created_at",{ascending:false}).limit(100);
 query=archived?query.not("archived_at","is",null):query.is("archived_at",null);const {data,error}=await query;if(error)throw new Error(`Notifications could not load: ${error.message}`);
 return <main className="mx-auto min-h-screen max-w-5xl px-5 py-10 sm:px-8 sm:py-section"><header className="flex flex-wrap items-end justify-between gap-5 border-b border-line pb-7"><div><p className="text-sm text-brand">{school.name}</p><h1 className="mt-3 font-display text-5xl">Notifications</h1><p className="mt-3 text-sm text-muted">A durable record of alerts and requests requiring your attention.</p></div><nav className="flex gap-5 text-sm"><Link href={`/schools/${schoolId}/notifications`} className={!archived?"text-brand":"text-muted"}>Active</Link><Link href={`/schools/${schoolId}/notifications?view=archived`} className={archived?"text-brand":"text-muted"}>Archived</Link></nav></header><div className="mt-8"><NotificationList schoolId={schoolId} notices={data??[]} archived={archived}/></div></main>;
}

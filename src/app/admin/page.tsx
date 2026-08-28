import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/platform-admin";

export const dynamic="force-dynamic";
export const metadata={title:"Platform admin · Common Time",robots:{index:false,follow:false}};

type Signup={id:string;email:string;name:string|null;school_name:string|null;status:string;source:string;consented_at:string;created_at:string;updated_at:string};

export default async function PlatformAdminPage(){
 await requirePlatformAdmin();
 const admin=createAdminClient() as unknown as SupabaseClient;
 const [{data,error,count},{data:statusRows,error:statusError}]=await Promise.all([
  admin.from("early_access_signups").select("id,email,name,school_name,status,source,consented_at,created_at,updated_at",{count:"exact"}).order("created_at",{ascending:false}).limit(100),
  admin.from("early_access_signups").select("status"),
 ]);
 if(error||statusError)throw new Error("Early-access signups could not be loaded.");
 const signups=(data??[]) as Signup[],statusCounts=(statusRows??[]).reduce<Record<string,number>>((counts,row)=>{const status=String(row.status);counts[status]=(counts[status]??0)+1;return counts;},{});
 const dateTime=new Intl.DateTimeFormat("en-US",{dateStyle:"medium",timeStyle:"short",timeZone:"America/Chicago"});
 return <main className="mx-auto min-h-screen max-w-7xl px-5 py-10 sm:px-8 sm:py-section">
  <header className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-8"><div><p className="text-xs uppercase tracking-[0.14em] text-brand">Common Time platform</p><h1 className="mt-3 font-display text-5xl sm:text-6xl">Early access.</h1><p className="mt-4 text-sm text-muted">Private launch-interest records. Times shown in Chicago time.</p></div><nav className="flex gap-5 text-sm"><Link href="/" className="text-muted hover:text-ink">Open app</Link><Link href="/profile" className="text-muted hover:text-ink">Profile</Link></nav></header>
  <section className="grid gap-px border-b border-line bg-line sm:grid-cols-3"><Metric label="Total signups" value={count??0}/><Metric label="Subscribed" value={statusCounts.subscribed??0}/><Metric label="Invited or converted" value={(statusCounts.invited??0)+(statusCounts.converted??0)}/></section>
  <section className="py-10"><div className="flex items-baseline justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.14em] text-brand">Launch list</p><h2 className="mt-2 font-display text-3xl">Most recent signups</h2></div><span className="text-xs text-muted">Showing up to 100</span></div>
   {signups.length?<div className="mt-6 overflow-x-auto border-y border-line"><table className="w-full min-w-[52rem] text-left text-sm"><thead className="text-xs text-muted"><tr><th className="py-3 pr-5 font-normal">Email</th><th className="py-3 pr-5 font-normal">Name</th><th className="py-3 pr-5 font-normal">School</th><th className="py-3 pr-5 font-normal">Status</th><th className="py-3 font-normal">Joined</th></tr></thead><tbody className="divide-y divide-line">{signups.map((signup)=><tr key={signup.id}><td className="py-4 pr-5 font-medium"><a href={`mailto:${signup.email}`} className="hover:text-brand">{signup.email}</a></td><td className="py-4 pr-5 text-muted">{signup.name||"—"}</td><td className="py-4 pr-5 text-muted">{signup.school_name||"—"}</td><td className="py-4 pr-5 capitalize text-brand">{signup.status}</td><td className="py-4 text-muted">{dateTime.format(new Date(signup.consented_at))}</td></tr>)}</tbody></table></div>:<p className="mt-6 border-y border-line py-10 text-sm text-muted">No early-access signups yet.</p>}
  </section>
 </main>;
}

function Metric({label,value}:{label:string;value:number}){return <div className="bg-canvas px-5 py-6"><p className="text-xs text-muted">{label}</p><p className="mt-2 font-display text-4xl">{value}</p></div>}

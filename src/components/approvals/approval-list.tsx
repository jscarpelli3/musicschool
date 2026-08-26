import Link from "next/link";
import type { OwnerApprovalItem } from "@/lib/approvals/owner-approvals";

export function ApprovalList({schoolId,items,timezone,compact=false}:{schoolId:string;items:OwnerApprovalItem[];timezone:string;compact?:boolean}){
 const dateTime=new Intl.DateTimeFormat("en-US",{timeZone:timezone,month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
 if(!items.length)return compact?null:<p className="border-y border-line py-8 text-sm text-muted">No approvals need a decision.</p>;
 return <div className="divide-y divide-line border-y border-line">{items.map(item=><Link key={item.id} href={`/schools/${schoolId}/approvals?proposal=${item.id}`} className="grid gap-3 px-3 py-5 transition hover:bg-brand/10 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-sm font-medium">{item.teacher} → {item.student}</p><p className="mt-2 text-sm text-muted">Reschedule from {item.original?dateTime.format(new Date(item.original)):"the current time"} to {dateTime.format(new Date(item.proposed))}</p>{!compact?<p className="mt-2 text-xs text-muted">{item.reason}</p>:null}</div><span className="text-xs uppercase tracking-[0.12em] text-brand">Review →</span></Link>)}</div>;
}

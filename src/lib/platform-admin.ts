import "server-only";
import { redirect,notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requirePlatformAdmin(nextPath="/admin"){
 const supabase=await createClient(),{data:auth}=await supabase.auth.getClaims();
 if(!auth?.claims?.sub)redirect(`/login?next=${encodeURIComponent(nextPath)}`);
 const rpc=supabase.rpc as unknown as(name:string)=>Promise<{data:boolean|null;error:unknown}>;
 const {data,error}=await rpc.call(supabase,"is_platform_admin");
 if(error||data!==true)notFound();
 return{profileId:auth.claims.sub};
}

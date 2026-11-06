"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { protectServerAction, RequestBoundaryError } from "@/lib/security/request-boundary";

export type CreateSchoolState = { error: string | null };

export async function createSchool(
  _state: CreateSchoolState,
  formData: FormData,
): Promise<CreateSchoolState> {
  const name = String(formData.get("name") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "America/Chicago");

  if (!name) return { error: "Enter a school name." };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");
  try {
    await protectServerAction({ scope: "school.create", subject: `actor:${claims.claims.sub}`, limit: 3, windowSeconds: 86400, blockSeconds: 3600 });
  } catch (caught) {
    return { error: caught instanceof RequestBoundaryError && caught.code === "rate_limited"
      ? "Too many school-creation attempts were made. Wait before trying again."
      : "This request could not be validated. Reload and try again." };
  }

  const { data: schoolId, error } = await supabase.rpc("create_school", {
    school_name: name,
    school_timezone: timezone,
  });

  if (error || !schoolId) {
    return { error: error?.message.includes("school_onboarding_invitation_required")
      ? "This account does not have an active beta invitation. Ask Common Time to confirm the email address on your invitation."
      : "The school could not be created. Nothing was changed; try again." };
  }

  redirect(`/schools/${schoolId}/onboarding`);
}

export async function createTrialSchool(_state:CreateSchoolState,formData:FormData):Promise<CreateSchoolState>{
 const name=String(formData.get("name")??"").trim(),timezone=String(formData.get("timezone")??"America/Chicago");if(!name)return{error:"Enter a school name."};
 const supabase=await createClient(),{data:claims}=await supabase.auth.getClaims();if(!claims?.claims?.sub)redirect("/login?next=%2Fsetup%3Ftrial%3D1");
 try{await protectServerAction({scope:"school.public_trial.create",subject:`actor:${claims.claims.sub}`,limit:3,windowSeconds:86400,blockSeconds:3600});}catch{return{error:"This request could not be completed yet. Wait a moment and try again."};}
 const rpc=supabase.rpc.bind(supabase) as unknown as(name:string,args:Record<string,unknown>)=>Promise<{data:string|null;error:{message:string}|null}>;
 const{data:schoolId,error}=await rpc("create_trial_school",{school_name:name,school_timezone:timezone});if(error||!schoolId)return{error:"The school could not be created. Nothing was charged; try again."};
 redirect(`/schools/${schoolId}/subscription`);
}

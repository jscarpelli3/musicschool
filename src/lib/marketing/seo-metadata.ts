import type {Metadata} from "next";

export function seoMetadata(title:string,description:string,path:string):Metadata{
 const url=`https://www.commontime.studio${path}`;
 return {title:{absolute:title},description,alternates:{canonical:url},robots:{index:true,follow:true},openGraph:{type:"website",url,siteName:"Common Time",title,description},twitter:{card:"summary_large_image",title,description}};
}

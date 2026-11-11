/* Common Time PWA lifecycle worker.
 * Authenticated school data is intentionally never cached here. */
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",(event)=>event.waitUntil(self.clients.claim()));
self.addEventListener("push",(event)=>{
  if(!event.data)return;
  let data={};
  try{data=event.data.json();}catch{return;}
  const title=typeof data.title==="string"?data.title:"Common Time";
  const options={
    body:typeof data.body==="string"?data.body:"You have a new notification.",
    icon:"/app-icons/common-time-192.png",
    badge:"/app-icons/common-time-192.png",
    tag:typeof data.tag==="string"?data.tag:"common-time-notification",
    data:{url:typeof data.url==="string"?data.url:"/"},
  };
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener("notificationclick",(event)=>{
  event.notification.close();
  const raw=event.notification.data?.url;
  const target=new URL(typeof raw==="string"?raw:"/",self.location.origin);
  if(target.origin!==self.location.origin)return;
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    for(const client of windows){if("focus" in client){await client.focus();if("navigate" in client)await client.navigate(target.href);return;}}
    await self.clients.openWindow(target.href);
  })());
});

import "server-only";

export type SchoolWeather={kind:"clear"|"cloudy"|"rain"|"snow"|"storm"|"fog";summary:string;temperature:string};
type SchoolAddress={address_line_1:string|null;city:string|null;region:string|null;postal_code:string|null};

const requestHeaders={"User-Agent":"Common Time school dashboard (https://commontime.studio)",Accept:"application/geo+json, application/json"};

export async function loadSchoolWeather(address:SchoolAddress):Promise<SchoolWeather|null>{
  if(!address.address_line_1||!address.city||!address.region)return null;
  try{
    const query=new URLSearchParams({address:[address.address_line_1,address.city,address.region,address.postal_code].filter(Boolean).join(", "),benchmark:"Public_AR_Current",format:"json"});
    const geocode=await fetch(`https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?${query}`,{headers:requestHeaders,next:{revalidate:60*60*24*30},signal:AbortSignal.timeout(5000)});
    if(!geocode.ok)return null;
    const geocodeData=await geocode.json() as {result?:{addressMatches?:Array<{coordinates?:{x?:number;y?:number}}>}};
    const coordinates=geocodeData.result?.addressMatches?.[0]?.coordinates;
    if(typeof coordinates?.x!=="number"||typeof coordinates.y!=="number")return null;
    const point=await fetch(`https://api.weather.gov/points/${coordinates.y.toFixed(4)},${coordinates.x.toFixed(4)}`,{headers:requestHeaders,next:{revalidate:60*60*24*7},signal:AbortSignal.timeout(5000)});
    if(!point.ok)return null;
    const pointData=await point.json() as {properties?:{forecast?:string}};
    if(!pointData.properties?.forecast)return null;
    const forecast=await fetch(pointData.properties.forecast,{headers:requestHeaders,next:{revalidate:60*30},signal:AbortSignal.timeout(5000)});
    if(!forecast.ok)return null;
    const forecastData=await forecast.json() as {properties?:{periods?:Array<{shortForecast?:string;temperature?:number;temperatureUnit?:string}>}};
    const period=forecastData.properties?.periods?.[0];
    if(!period?.shortForecast)return null;
    const phrase=period.shortForecast.toLowerCase();
    const kind:SchoolWeather["kind"]=phrase.includes("thunder")?"storm":phrase.includes("snow")||phrase.includes("sleet")||phrase.includes("ice")?"snow":phrase.includes("rain")||phrase.includes("shower")||phrase.includes("drizzle")?"rain":phrase.includes("fog")||phrase.includes("haze")?"fog":phrase.includes("cloud")||phrase.includes("overcast")?"cloudy":"clear";
    return{kind,summary:period.shortForecast,temperature:typeof period.temperature==="number"?`${period.temperature}°${period.temperatureUnit??"F"}`:""};
  }catch{return null;}
}

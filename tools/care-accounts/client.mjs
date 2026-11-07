/* Read-only adapter for the future account UI. Not loaded by the public site.
 * Access tokens come from a supplied Auth session, never from local room state. */
const isLoopback = host => ['127.0.0.1','localhost','[::1]'].includes(host);
export function validateConfig({url, publishableKey, allowLocal=false}) {
  const parsed = new URL(url);
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw new Error('Use the project origin only.');
  if (!(parsed.protocol==='https:' && /^[a-z0-9-]+\.supabase\.co$/.test(parsed.hostname)) &&
      !(allowLocal && parsed.protocol==='http:' && isLoopback(parsed.hostname))) throw new Error('Use a Supabase HTTPS project or explicitly enabled local development.');
  if (typeof publishableKey!=='string' || !publishableKey.startsWith('sb_publishable_') || publishableKey.length<20) throw new Error('A public Supabase publishable key is required. Privileged and legacy keys are not accepted.');
  return {origin:parsed.origin,publishableKey};
}
export function createBackendClient(config,{getAccessToken,fetchImpl=fetch}={}) {
  const {origin,publishableKey}=validateConfig(config);
  if(typeof getAccessToken!=='function')throw new Error('An Auth session provider is required.');
  const uuid=value=>{if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw new Error('Invalid room reference.');return value;};
  async function read(table,params){
    const token=await getAccessToken();
    if(!token)throw new Error('Sign in to load a care room.');
    const target=new URL(`/rest/v1/${table}`,origin);target.search=new URLSearchParams(params).toString();
    const response=await fetchImpl(target,{method:'GET',headers:{apikey:publishableKey,Authorization:`Bearer ${token}`,Accept:'application/json'},cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error(`Unable to load care-room data (${response.status}).`);
    const data=await response.json();if(!Array.isArray(data))throw new Error('Unexpected care-room response.');return data;
  }
  return Object.freeze({
    listRooms:()=>read('care_rooms',{select:'id,patient_id,list_version,created_at',order:'created_at.desc'}),
    readRoom:id=>read('care_rooms',{select:'id,patient_id,list_version,created_at',id:`eq.${uuid(id)}`}),
    listMedicines:id=>read('room_medicines',{select:'kind,medicine_id',room_id:`eq.${uuid(id)}`}),
    listTools:id=>read('patient_tools',{select:'id,tool_type,message,local_time,timezone,tool_status,proposed_by,revision',room_id:`eq.${uuid(id)}`}),
    listEvents:id=>read('room_events',{select:'id,actor_id,event_type,list_version,details,recorded_at',room_id:`eq.${uuid(id)}`,order:'id.desc',limit:'100'})
  });
}

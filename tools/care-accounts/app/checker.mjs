// Read-only link between a care-room list and the public HerbBridge checker data.
// Uses the same lookup logic and JSON as the guest checker; private lists are never sent anywhere.
import lookup from 'herbbridge-lookup';

export const CHECK_WORDS={
 en:{checkTitle:'Interaction check',checkIntro:'Each Chinese herb is checked against each Western medicine on this list, using the same data as the HerbBridge checker.',checkLoading:'Loading interaction data…',checkFailed:'Interaction data could not be loaded. The list itself is unchanged.',checkNeedBoth:'You can keep a list with only Chinese herbs or only Western medicines. The interaction check starts once the list has at least one of each.',checkOpen:'Open full results and doctor summary',checkOpenHelp:'Opens the HerbBridge checker in a new tab with this list. It is not saved there unless you choose to.',checkDisclaimer:'HerbBridge gives information, not medical advice. Never stop or change a medicine without talking to your doctor or pharmacist.',checkReview:'Ratings come from published research and official health guidance. AI assists with summaries, translations and team ratings, which have not yet been reviewed by a pharmacist.',risk_high:'High risk',risk_moderate:'Moderate risk',risk_low:'Low risk',risk_low_watch:'Low risk · watch',risk_none_reported:'No reported risk',risk_not_in_database:'Not in our database',risk_official:'Official caution',risk_official_disagree:'Official caution · sources disagree',checkNotSafe:'“Not in our database” does not mean the pair is safe.',importGuest:'Import my list from this device',importTitle:'Import list from this device',importIntro:'This is the list saved in the HerbBridge checker on this device. Nothing is uploaded until you press Save to my care room.',importReplace:'Saving replaces the current list in your care room. Your change history keeps the old version.',importSave:'Save to my care room',importNone:'No saved checker list was found on this device.',importDone:'List imported into your care room.',importSame:'Your care room already has this list.'},
 zh:{checkTitle:'相互作用檢查',checkIntro:'用同中西通檢查器一樣嘅資料，逐隻中藥同清單上每隻西藥對比。',checkLoading:'載入緊相互作用資料…',checkFailed:'未能載入相互作用資料，清單本身未有更改。',checkNeedBoth:'清單可以只有中藥或者只有西藥。加入最少一隻中藥同一隻西藥之後，就會開始檢查相互作用。',checkOpen:'打開完整結果同醫生摘要',checkOpenHelp:'喺新分頁用呢張清單打開中西通檢查器。除非你自己揀，否則唔會儲存喺嗰度。',checkDisclaimer:'中西通只提供資訊，唔係醫療建議。未同醫生或者藥劑師傾過之前，千祈唔好自行停藥或者改藥。',checkReview:'評級來自已發表研究同官方健康指引。人工智能協助整理摘要、翻譯同團隊評級，暫時未經藥劑師審閱。',risk_high:'高度風險',risk_moderate:'中度風險',risk_low:'低度風險',risk_low_watch:'低度風險 · 要留意',risk_none_reported:'未有報告風險',risk_not_in_database:'資料庫未有記錄',risk_official:'官方提醒',risk_official_disagree:'官方提醒 · 資料講法唔一致',checkNotSafe:'「資料庫未有記錄」唔代表一齊食冇問題。',importGuest:'匯入呢部裝置上嘅清單',importTitle:'匯入呢部裝置上嘅清單',importIntro:'呢張係呢部裝置上中西通檢查器儲存咗嘅清單。你㩒「儲存到我嘅照護室」之前，唔會上載任何資料。',importReplace:'儲存之後會取代照護室而家嘅清單，更改記錄會保留舊版本。',importSave:'儲存到我嘅照護室',importNone:'呢部裝置上搵唔到已儲存嘅檢查器清單。',importDone:'已將清單匯入照護室。',importSame:'照護室已經係呢張清單。'}
};

// Reads the guest checker's list from this device only (same key as js/app.js). Never uploads by itself.
export function readGuestList(storage=globalThis.localStorage,catalog=[]){
 try{const saved=JSON.parse(storage.getItem('herbsafe.v1')||'null');if(!saved||typeof saved!=='object')return [];
  const source=saved.demo===true&&saved.demoBackup&&typeof saved.demoBackup==='object'?saved.demoBackup:saved;
  const known=new Set(catalog.map(x=>x.kind+':'+x.id)),out=[],seen=new Set();
  for(const [kind,ids] of [['herb',source.herbs],['drug',source.drugs]])for(const id of Array.isArray(ids)?ids:[]){const k=kind+':'+id;if(typeof id==='string'&&known.has(k)&&!seen.has(k)){seen.add(k);out.push({kind,id});}}
  return out;
 }catch{return [];}
}

const FILES=['herbs','drugs','interactions','official','reviews'];
const MAX_LINK=4096;

export function riskKey(row){
 if(row.status==='official')return row.official&&row.official.kind==='disagree'?'risk_official_disagree':'risk_official';
 if(row.status==='low'&&row.entry&&row.entry.watch)return 'risk_low_watch';
 return 'risk_'+row.status;
}

// Same fragment format as js/share.js, so the guest checker opens it read-only.
export function summaryLink(list,base='../'){
 const json=JSON.stringify({v:1,h:list.herbs,d:list.drugs});
 if(!/^[\x00-\x7f]*$/.test(json))throw new TypeError('List IDs must be ASCII');
 const value=btoa(json).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 if(value.length+13>MAX_LINK)throw new RangeError('List is too long');
 return base+'#/summary?l='+value;
}

export function createChecker({fetchImpl=(...a)=>fetch(...a),base='../data/'}={}){
 let db=null,loading=null;
 async function load(){
  if(db)return db;
  if(!loading)loading=(async()=>{
   const parts=await Promise.all(FILES.map(async name=>{const res=await fetchImpl(base+name+'.json',{credentials:'omit',cache:'no-cache'});if(!res.ok)throw new Error('data_unavailable');return res.json();}));
   db=lookup.createDb(...parts);return db;
  })().catch(error=>{loading=null;throw error;});
  return loading;
 }
 function check(items){
  if(!db)return null;
  const herbs=items.filter(x=>x.kind==='herb').map(x=>x.id),drugs=items.filter(x=>x.kind==='drug').map(x=>x.id);
  return {herbs,drugs,rows:lookup.checkPairs(db,herbs,drugs)};
 }
 return {load,check,get ready(){return !!db;},name:(kind,id,lang)=>{const item=db&&(kind==='herb'?db.herbById[id]:db.drugById[id]);return item?(lang==='zh'?item.name_zh:item.name_en):id;}};
}

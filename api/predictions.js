const {Pool}=require('pg');
const {unpack,cookies}=require('./auth/discord/_shared');
const {ensurePredictionTables}=require('./_prediction-schema');
const API='https://api.mcsrranked.com';
let pool;
const db=()=>pool||(pool=new Pool({connectionString:process.env.DATABASE_URL,max:3}));
const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const hash=t=>{let h=2166136261;for(let i=0;i<t.length;i++)h=Math.imul(h^t.charCodeAt(i),16777619);return h>>>0};
async function ranked(path){const response=await fetch(API+path,{signal:AbortSignal.timeout(8500)});if(!response.ok)throw Error('Ranked API unavailable');const json=await response.json();if(json.status!=='success')throw Error('Ranked API failed');return json.data}
const dateOf=m=>Number(m.date)||0;
const changeOf=(m,id)=>{const c=(m.changes||[]).find(x=>x.uuid===id);return c&&Number.isFinite(Number(c.change))?Number(c.change):null};
async function matches(id,count=30){const data=await ranked('/users/'+encodeURIComponent(id)+'/matches?count='+count+'&type=2');return Array.isArray(data)?data:[]}
function oddsFor(list,id){const valid=list.map(m=>changeOf(m,id)).filter(x=>x!==null&&x!==0);const gain=valid.filter(x=>x>0).length;const p=Math.max(.2,Math.min(.8,(gain+3)/(valid.length+6)));return {gain:Math.max(110,Math.min(500,Math.floor(95/p))),loss:Math.max(110,Math.min(500,Math.floor(95/(1-p))))}}
const sessionGap=p=>(p.elo>=2500?3:p.rank<=150?2:1)*3600;
async function roster(){
 const board=await ranked('/leaderboard');
 const users=(board.users||[]).filter(u=>u&&u.nickname&&u.uuid);
 const d=day();
 const shuffle=(arr,salt)=>arr.slice().sort((a,b)=>hash(d+salt+a.nickname)-hash(d+salt+b.nickname));
 const candidates=[...shuffle(users.slice(0,50),'top'),...shuffle(users.slice(50,150),'mid')];
 const now=Math.floor(Date.now()/1000);
 const checked=await Promise.all(candidates.map(async u=>{
  const p={uuid:u.uuid,nickname:u.nickname,rank:users.indexOf(u)+1,elo:Number(u.eloRate??u.seasonResult?.eloRate??0)};
  try{
   const recent=await matches(p.uuid,1);
   const latest=recent.map(dateOf).filter(Number.isFinite).filter(t=>t>0).sort((a,b)=>b-a)[0];
   return latest&&now-latest>sessionGap(p)?p:null;
  }catch(e){return null}
 }));
 const eligible=checked.filter(Boolean);
 const top=eligible.filter(p=>p.rank<=50).slice(0,3);
 const other=eligible.filter(p=>p.rank>50).slice(0,7);
 const selected=[...top,...other];
 if(selected.length<10)selected.push(...eligible.filter(p=>!selected.some(x=>x.uuid===p.uuid)).slice(0,10-selected.length));
 return selected;
}
async function settle(client,items){
 for(const p of items){
  try{
   const list=(await matches(p.player_uuid,100)).filter(m=>dateOf(m)>0).sort((a,b)=>dateOf(a)-dateOf(b));
   const placed=Math.floor(new Date(p.placed_at).getTime()/1000);
   const end=Math.floor(new Date(p.placed_at).getTime()/1000)+86400;
   const relevant=list.filter(m=>dateOf(m)>placed&&dateOf(m)<=end);
   const now=Math.floor(Date.now()/1000);
   let status=null,delta=null,payout=0;
   if(!relevant.length){if(now>end)status='refunded';else continue}
   else{
    const gap=(Number(p.player_elo)>=2500?3:p.player_rank<=150?2:1)*3600;
    const session=[relevant[0]];
    for(let i=1;i<relevant.length;i++){if(dateOf(relevant[i])-dateOf(session[session.length-1])>gap)break;session.push(relevant[i])}
    if(now-dateOf(session[session.length-1])<=gap)continue;
    const changes=session.map(m=>changeOf(m,p.player_uuid));
    if(changes.some(v=>v===null))continue;
    delta=Math.round(changes.reduce((a,b)=>a+b,0));
    status=delta===0?'refunded':(delta>0?'gain':'loss')===p.direction?'won':'lost';
   }
   payout=status==='refunded'?Number(p.stake):status==='won'?Math.floor(Number(p.stake)*p.odds_basis_points/100):0;
   await client.query('BEGIN');
   const updated=await client.query("UPDATE ranked_predictions SET status=$2,resolved_at=NOW(),result_elo=$3,payout=$4 WHERE id=$1 AND status='pending' RETURNING discord_id",[p.id,status,delta,payout]);
   if(updated.rowCount&&payout)await client.query('UPDATE discord_wallets SET balance=balance+$2 WHERE discord_id=$1',[p.discord_id,payout]);
   await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK').catch(()=>{});console.error('Prediction settlement failed',p.id,e.message)}
 }
}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
 const session=unpack(cookies(req).discord_session);
 if(!session||session.exp<Date.now()||!/^[0-9]+$/.test(String(session.id||'')))return res.status(401).json({error:'Discord login required'});
 if(!process.env.DATABASE_URL)return res.status(503).json({error:'Database unavailable'});
 let client;
 try{
  client=await db().connect();await ensurePredictionTables(client);
  await client.query('ALTER TABLE ranked_predictions ADD COLUMN IF NOT EXISTS player_rank INTEGER');
  await client.query('ALTER TABLE ranked_predictions ADD COLUMN IF NOT EXISTS player_elo INTEGER');
  const pending=await client.query("SELECT * FROM ranked_predictions WHERE status='pending' AND discord_id=$1 ORDER BY placed_at LIMIT 20",[session.id]);
  if(pending.rows.length)await settle(client,pending.rows);
  if(req.method==='GET'){
   const [wallet,history,players]=await Promise.all([client.query('SELECT balance FROM discord_wallets WHERE discord_id=$1',[session.id]),client.query('SELECT id,player_name,direction,stake,odds_basis_points,status,payout,result_elo,placed_at FROM ranked_predictions WHERE discord_id=$1 ORDER BY id DESC LIMIT 30',[session.id]),roster()]);
   const odds=await Promise.all(players.map(async p=>({...p,odds:oddsFor(await matches(p.uuid,30),p.uuid)})));
   return res.status(200).json({balance:Number(wallet.rows[0]?.balance||0),players:odds,history:history.rows,day:day(),remaining:Math.max(0,3-history.rows.filter(p=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(p.placed_at))===day()).length)});
  }
  const {uuid,direction,stake}=req.body||{};
  if(typeof uuid!=='string'||!['gain','loss'].includes(direction)||!Number.isSafeInteger(stake)||stake<1||stake>1000000)return res.status(400).json({error:'Invalid prediction'});
  const players=await roster();const player=players.find(p=>p.uuid===uuid);if(!player)return res.status(400).json({error:'Player not in today\'s roster'});
  const odds=oddsFor(await matches(uuid,30),uuid)[direction];
  await client.query('BEGIN');
  const wallet=await client.query('SELECT balance FROM discord_wallets WHERE discord_id=$1 FOR UPDATE',[session.id]);
  if(!wallet.rows.length||Number(wallet.rows[0].balance)<stake){await client.query('ROLLBACK');return res.status(400).json({error:'Insufficient coins'})}
  const count=await client.query("SELECT COUNT(*)::int AS n FROM ranked_predictions WHERE discord_id=$1 AND jst_day=(NOW() AT TIME ZONE 'Asia/Tokyo')::date",[session.id]);
  if(count.rows[0].n>=3){await client.query('ROLLBACK');return res.status(400).json({error:'Daily limit reached'})}
  const dup=await client.query("SELECT 1 FROM ranked_predictions WHERE discord_id=$1 AND player_uuid=$2 AND jst_day=(NOW() AT TIME ZONE 'Asia/Tokyo')::date",[session.id,uuid]);
  if(dup.rowCount){await client.query('ROLLBACK');return res.status(400).json({error:'Already predicted this player today'})}
  await client.query('UPDATE discord_wallets SET balance=balance-$2 WHERE discord_id=$1',[session.id,stake]);
  const saved=await client.query("INSERT INTO ranked_predictions(discord_id,player_uuid,player_name,direction,stake,odds_basis_points,jst_day,player_rank,player_elo) VALUES($1,$2,$3,$4,$5,$6,(NOW() AT TIME ZONE 'Asia/Tokyo')::date,$7,$8) RETURNING id",[session.id,uuid,player.nickname,direction,stake,odds,player.rank,player.elo]);
  await client.query('COMMIT');return res.status(201).json({id:saved.rows[0].id,odds:odds/100,balance:Number(wallet.rows[0].balance)-stake});
 }catch(e){if(client)await client.query('ROLLBACK').catch(()=>{});console.error('Predictions API failed',e);return res.status(503).json({error:'Predictions temporarily unavailable'})}finally{client?.release()}
};

module.exports.settle=settle;
module.exports.db=db;
module.exports.ensurePredictionTables=ensurePredictionTables;

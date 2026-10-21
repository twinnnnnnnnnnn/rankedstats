const {Pool}=require('pg');
const {unpack,cookies}=require('./auth/discord/_shared');
let pool;
function db(){if(!process.env.DATABASE_URL)throw Error('Database not configured');return pool||(pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},max:3}))}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const session=unpack(cookies(req).discord_session);
 if(!session||session.exp<Date.now()||!/^[0-9]+$/.test(String(session.id||'')))return res.status(401).json({error:'Discord login required'});
 if(!process.env.DATABASE_URL)return res.status(503).json({error:'Wallet database not configured'});
 try{
  const client=await db().connect();
  try{
   await client.query('CREATE TABLE IF NOT EXISTS discord_wallets (discord_id TEXT PRIMARY KEY, balance BIGINT NOT NULL DEFAULT 100 CHECK (balance >= 0), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
   const result=await client.query('INSERT INTO discord_wallets (discord_id) VALUES ($1) ON CONFLICT (discord_id) DO UPDATE SET discord_id = EXCLUDED.discord_id RETURNING balance',[session.id]);
   return res.status(200).json({balance:Number(result.rows[0].balance),currency:'demo_coins'});
  }finally{client.release()}
 }catch(e){console.error('Wallet lookup failed',e);return res.status(503).json({error:'Wallet temporarily unavailable'})}
};

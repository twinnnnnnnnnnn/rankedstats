const { Pool } = require('pg');
let pool;
module.exports = async (req,res) => {
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 if(!process.env.DATABASE_URL)return res.status(503).json({error:'Database unavailable'});
 try{
  pool ||= new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},max:3});
  const result=await pool.query('SELECT COALESCE(NULLIF(username,\'\'),\'Discord user\') AS username, balance FROM discord_wallets ORDER BY balance DESC, created_at ASC LIMIT 100');
  return res.status(200).json({players:result.rows.map(r=>({username:r.username,balance:Number(r.balance)}))});
 }catch(e){console.error('Leaderboard lookup failed',e);return res.status(503).json({error:'Leaderboard unavailable'})}
};

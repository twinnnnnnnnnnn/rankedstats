const predictions=require('./predictions');
module.exports=async(req,res)=>{
 if(req.method!=='GET')return res.status(405).end();
 if(!process.env.CRON_SECRET||req.headers.authorization!=='Bearer '+process.env.CRON_SECRET)return res.status(401).json({error:'Unauthorized'});
 if(!process.env.DATABASE_URL)return res.status(503).json({error:'Database unavailable'});
 let client;
 try{
  client=await predictions.db().connect();
  await predictions.ensurePredictionTables(client);
  const pending=await client.query("SELECT * FROM ranked_predictions WHERE status='pending' ORDER BY placed_at LIMIT 100");
  await predictions.settle(client,pending.rows);
  return res.status(200).json({checked:pending.rows.length});
 }catch(e){console.error('Scheduled settlement failed',e);return res.status(503).json({error:'Settlement unavailable'})}finally{client?.release()}
};
const {ORIGIN,CALLBACK,pack,unpack,cookies,cookie,configured}=require('./_shared');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Set-Cookie',cookie('discord_oauth_state','',0));
 if(req.method!=='GET')return res.status(405).end();
 if(!configured())return res.status(503).send('Discord login is not configured');
 const state=unpack(cookies(req).discord_oauth_state);
 if(!state||state.exp<Date.now()||typeof req.query.state!=='string'||req.query.state!==state.state||typeof req.query.code!=='string')return res.status(400).send('Invalid or expired Discord login. Please try again.');
 try{
  const token=await fetch('https://discord.com/api/v10/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.DISCORD_CLIENT_ID,client_secret:process.env.DISCORD_CLIENT_SECRET,grant_type:'authorization_code',code:req.query.code,redirect_uri:CALLBACK})});
  if(!token.ok)throw Error('Token exchange failed');
  const t=await token.json();
  const user=await fetch('https://discord.com/api/v10/users/@me',{headers:{Authorization:'Bearer '+t.access_token}});
  if(!user.ok)throw Error('User lookup failed');
  const u=await user.json();
  if(!/^\d+$/.test(String(u.id)))throw Error('Invalid Discord account');
  const session=pack({id:String(u.id),username:String(u.global_name||u.username||'Discord user').slice(0,100),exp:Date.now()+7*86400000});
  res.setHeader('Set-Cookie',[cookie('discord_oauth_state','',0),cookie('discord_session',session,7*86400)]);
  res.writeHead(302,{Location:ORIGIN+'/?discord=connected'});res.end();
 }catch(e){res.status(502).send('Discord login failed. Please retry from the website.')}
};

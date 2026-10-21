const crypto=require('node:crypto');
const {CALLBACK,pack,cookie,configured}=require('./_shared');
module.exports=(req,res)=>{
 if(req.method!=='GET')return res.status(405).end();
 if(!configured())return res.status(503).send('Discord login is not configured');
 const state=crypto.randomBytes(24).toString('base64url');
 res.setHeader('Set-Cookie',cookie('discord_oauth_state',pack({state,exp:Date.now()+600000}),600));
 const q=new URLSearchParams({client_id:process.env.DISCORD_CLIENT_ID,redirect_uri:CALLBACK,response_type:'code',scope:'identify',state,prompt:'consent'});
 res.writeHead(302,{Location:'https://discord.com/oauth2/authorize?'+q});res.end();
};

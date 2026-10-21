const {cookie}=require('./_shared');
module.exports=(req,res)=>{if(req.method!=='POST')return res.status(405).end();res.setHeader('Set-Cookie',cookie('discord_session','',0));res.status(200).json({ok:true})};

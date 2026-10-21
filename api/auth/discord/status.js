const {unpack,cookies,configured}=require('./_shared');
module.exports=(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).end();
 if(!configured())return res.status(503).json({authenticated:false,configured:false});
 const session=unpack(cookies(req).discord_session);
 if(!session||session.exp<Date.now())return res.status(200).json({authenticated:false});
 return res.status(200).json({authenticated:true,discordUsername:session.username,rankedVerified:false});
};

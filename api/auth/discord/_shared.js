const crypto=require('node:crypto');
const ORIGIN='https://rankedstats.vercel.app';
const CALLBACK=ORIGIN+'/api/auth/discord/callback';
function secret(){return process.env.DISCORD_SESSION_SECRET||process.env.DISCORD_CLIENT_SECRET}
function sign(value){return crypto.createHmac('sha256',secret()).update(value).digest('base64url')}
function pack(data){const payload=Buffer.from(JSON.stringify(data)).toString('base64url');return payload+'.'+sign(payload)}
function unpack(value){if(!value||!secret())return null;const [p,s]=value.split('.');if(!p||!s)return null;const a=Buffer.from(sign(p)),b=Buffer.from(s);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;try{return JSON.parse(Buffer.from(p,'base64url').toString())}catch{return null}}
function cookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').map(x=>{const i=x.indexOf('=');return i<0?['','']:[x.slice(0,i).trim(),x.slice(i+1).trim()]}))}
function cookie(name,value,maxAge){return name+'='+value+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+maxAge}
function configured(){return !!(process.env.DISCORD_CLIENT_ID&&process.env.DISCORD_CLIENT_SECRET)}
module.exports={ORIGIN,CALLBACK,pack,unpack,cookies,cookie,configured};

const crypto=require("crypto");

function getAdminCredentials(){
  const ADMIN_USER=String(process.env.ADMIN_USERNAME||process.env.ADMIN_USER||"admin").trim()||"admin";
  const ADMIN_PASS=String(process.env.ADMIN_PASSWORD||"").trim()||null;
  const ADMIN_HASH=String(process.env.ADMIN_PASSWORD_HASH||"").trim()||null;
  return {ADMIN_USER,ADMIN_PASS,ADMIN_HASH};
}

async function adminCredentialsValid(username,password){
  const {ADMIN_USER,ADMIN_PASS,ADMIN_HASH}=getAdminCredentials();
  const inputUser=String(username||"").trim();
  const inputPass=String(password||"").trim();
  if(!inputUser||inputUser.toLowerCase()!==ADMIN_USER.toLowerCase())return false;
  if(ADMIN_HASH){
    try{
      const bcrypt=require("bcryptjs");
      if(await bcrypt.compare(inputPass,ADMIN_HASH))return true;
    }catch(error){console.warn("[Admin Auth] bcrypt comparison failed:",error.message);}
  }
  // Fail closed: never authenticate with an embedded/default password.
  if(!ADMIN_PASS)return false;
  return inputPass===ADMIN_PASS;
}

function isAdminAuthenticated(req){
  return Boolean(req.session?.isAdmin===true);
}

function requireAdmin(req,res,next){
  if(isAdminAuthenticated(req))return next();
  const isApiRequest=String(req.originalUrl||"").startsWith("/api/")||String(req.baseUrl||"").startsWith("/api/");
  if(isApiRequest)return res.status(401).json({success:false,message:"Session expired",redirect:"/login"});
  return res.redirect("/login?next="+encodeURIComponent(req.originalUrl||"/admin"));
}

function setSessionCookie(){return null;}
function clearSessionCookie(res,req){
  if(!req.session)return res.redirect("/");
  req.session.destroy(err=>{
    if(err)console.error("[Session Destroy Error]:",err);
    res.clearCookie("connect.sid",{path:"/"});
    return res.redirect("/");
  });
}

module.exports={isAdminAuthenticated,requireAdmin,adminCredentialsValid,setSessionCookie,clearSessionCookie,getAdminCredentials};
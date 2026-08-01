/* Migrate local sarees.db -> Turso (products WITH photos only) */
require('dotenv').config();
const path=require('path'),fs=require('fs'),sqlite3=require('sqlite3');
const{createClient}=require('@libsql/client');const cloud=require('cloudinary').v2;
const TU=process.env.TURSO_DATABASE_URL,TT=process.env.TURSO_AUTH_TOKEN;
const CN=process.env.CLOUDINARY_CLOUD_NAME,AK=process.env.CLOUDINARY_API_KEY,AS=process.env.CLOUDINARY_API_SECRET;
if(!(TU&&TT&&CN&&AK&&AS)){console.error('Set TURSO_* & CLOUDINARY_* in .env first');process.exit(1);}
cloud.config({cloud_name:CN,api_key:AK,api_secret:AS});
const L=new sqlite3.Database(path.join(__dirname,'sarees.db'),sqlite3.OPEN_READONLY,e=>{if(e){console.error('local db:',e.message);process.exit(1);}});
const T=createClient({url:TU,authToken:TT});
const q=(s,a=[])=>T.execute({sql:s,args:a,rowMode:'object'});
const up=path.join(__dirname,'uploads');
async function img(u){if(/^https?:\/\//i.test(u))return u;const f=path.join(up,path.basename(u));if(!fs.existsSync(f)){console.warn('skip missing',u);return null;}const r=await cloud.uploader.upload(f,{folder:'saree_products'});console.log('cloud:',u,'->',r.secure_url);return r.secure_url;}
function rows(s,p,cb){L.all(s,p,(er,r)=>{if(er){console.error(er.message);process.exit(1);}cb(r);});}
rows(`SELECT name,description,price,sale_price,fabric,color,size,category,image_url,stock,is_featured,created_at FROM products WHERE image_url!=''`,[],async(P)=>{
  console.log('products with photos:',P.length);
  const cats=[...new Set(P.map(p=>p.category).filter(Boolean))];
  rows(`SELECT name,description,image_url FROM categories WHERE name IN (${cats.map(()=>'?').join(',')})`,cats,async(C)=>{
    for(const c of C){await q('INSERT OR IGNORE INTO categories(name,description,image_url) VALUES(?,?,?)',[c.name,c.description||'',c.image_url||'']);console.log('cat:',c.name);}
    let ok=0,sk=0;
    for(const p of P){
      const i=await img(p.image_url);if(!i){sk++;continue;}
      await q(`INSERT INTO products(name,description,price,sale_price,fabric,color,size,category,image_url,stock,is_featured,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,COALESCE(?,CURRENT_TIMESTAMP))`,[p.name,p.description||'',p.price,p.sale_price,p.fabric||'',p.color||'',p.size||'U (6.3 m)',p.category||'General',i,p.stock??10,p.is_featured?1:0,p.created_at||null]);
      ok++;console.log('product:',p.name);
    }
    console.log('DONE:',ok,'migrated,',sk,'skipped');process.exit(0);
  });
});
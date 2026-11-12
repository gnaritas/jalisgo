const http=require("http"),fs=require("fs"),path=require("path");
const root=path.join(__dirname,"public");
http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split("?")[0]);
  if(p==="/healthz"){res.writeHead(200,{"content-type":"text/plain"});return res.end("ok");}
  if(p==="/")p="/index.html";
  const f=path.join(root,p);
  fs.readFile(f,(e,d)=>{
    if(e){res.writeHead(404,{"content-type":"text/plain"});return res.end("not found");}
    const ext=path.extname(f).toLowerCase();
    const ct={".html":"text/html",".css":"text/css",".js":"text/javascript",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".svg":"image/svg+xml",".ico":"image/x-icon"}[ext]||"application/octet-stream";
    res.writeHead(200,{"content-type":ct});res.end(d);
  });
}).listen(process.env.PORT||3000,()=>console.log("site up on "+(process.env.PORT||3000)));

const express=require('express');
const app=express();
const PORT=process.env.PORT||3000;
app.use(express.json({limit:'8mb'}));

// Shared navigation extension: keep Pre-Start History as a permanent desktop menu item
// without changing the individual operational page modules.
app.use((req,res,next)=>{
  const originalSend=res.send.bind(res);
  res.send=(body)=>{
    if(typeof body==='string'&&body.includes('<span class="navlabel">WORKFORCE</span>')&&!body.includes('href="/prestart-history"')){
      const active=req.path==='/prestart-history'?'on':'';
      const historyLink=`<a class="${active}" href="/prestart-history" title="Pre-Start History"><span class="navicon"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></span><span class="navtext">Pre-Start History</span><span class="navchev">›</span></a>`;
      body=body.replace('<span class="navlabel">WORKFORCE</span>',historyLink+'<span class="navlabel">WORKFORCE</span>');
    }
    return originalSend(body);
  };
  next();
});

app.use(require('./src/routes/assets'));
app.use(require('./src/routes/asset-qr'));
app.use(require('./src/routes/employees'));
app.use(require('./src/routes/prestart-config'));
app.use(require('./src/routes/prestarts-mobile'));
app.use(require('./src/routes/prestart-history'));
app.get('/',(req,res)=>res.redirect('/assets'));
app.use((req,res)=>res.status(404).send('Supervisor365 page not found'));
app.listen(PORT,'0.0.0.0',()=>console.log('Supervisor365 modular master running on '+PORT));

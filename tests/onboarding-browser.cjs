const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844}});let stage='login',appLoads=0;const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
 const u=new URL(route.request().url());
 if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><div class="app">CHAT</div><script src="/auth-ui.js"></script>'});
 if(u.pathname==='/auth-ui.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync('auth-ui.js','utf8')});
 if(u.pathname==='/api/session')return route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({authenticated:false,onboarding:stage==='login'?null:{nick:'Dan',emailVerified:stage==='identity'}})});
 if(u.pathname==='/api/login'){stage='email';return route.fulfill({json:{ok:true,onboarding:true}})}
 if(u.searchParams.get('action')==='request-link')return route.fulfill({json:{ok:true,message:'Confirmation email sent.'}});
 if(u.searchParams.get('action')==='identity-start')return route.fulfill({json:{ok:true,challenge:'a'.repeat(48),command:'/msg PrincessGPT !verify '+'a'.repeat(48)}});
 if(u.searchParams.get('action')==='identity-status')return route.fulfill({json:{ok:true,verified:false,message:'Waiting for X.'}});
 if(u.pathname.endsWith('.js'))appLoads++;
 return route.fulfill({contentType:'text/javascript',body:''});
 });
 await page.goto('https://braintrust.example.test/');await page.locator('#btNick').fill('Dan');await page.locator('#btCode').fill('invite');await page.getByRole('button',{name:'CONTINUE WITH INVITE CODE'}).click();
 await page.getByRole('heading',{name:'Finish registration'}).waitFor();assert.equal(appLoads,0);
 await page.locator('#btEmail').fill('dan@example.test');await page.getByRole('button',{name:'CONFIRM EMAIL',exact:true}).click();await page.getByText('Confirmation email sent.').waitFor();
 stage='identity';await page.reload();await page.getByRole('button',{name:'CREATE VERIFICATION COMMAND'}).click();await page.getByRole('button',{name:'CHECK VERIFICATION'}).click();await page.getByText('Waiting for X.').waitFor();
 assert.equal(appLoads,0);assert.deepEqual(errors,[]);assert.equal(await page.locator('#btAuthCard').evaluate(e=>e.scrollWidth>e.clientWidth),false);
 console.log('Mobile browser: invite → email → identity, no app scripts loaded before verification; no errors or horizontal overflow.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});

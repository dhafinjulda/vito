async page=>{
  let release;
  await page.route('**/glasses-alt.glb',async route=>{
    await page.evaluate(()=>{window.choiceBlocked=true;});
    await new Promise(resolve=>{release=resolve;});await route.continue().catch(()=>{});
  });
  try {
    await page.goto('http://localhost:5173/');
    await page.evaluate(()=>{window.choiceBlocked=false;window.choiceCameraCalls=0;navigator.mediaDevices.getUserMedia=async()=>{window.choiceCameraCalls++;throw Error('Unexpected camera');};});
    await page.locator('[data-product="1"]').click();
    await page.waitForFunction(()=>window.choiceBlocked);
    const responsive=await page.evaluate(()=>[...document.querySelectorAll('[data-product]')].every(b=>!b.disabled)&&document.querySelector('[data-product="0"]').getAttribute('aria-pressed')==='true'&&document.querySelector('#product-state').textContent.includes('Memuat Linea'));
    await page.locator('[data-product="2"]').click();
    await page.waitForFunction(()=>document.querySelector('[data-product="2"]').getAttribute('aria-pressed')==='true');
    release?.();await page.unrouteAll({behavior:'ignoreErrors'});
    const latest=await page.evaluate(()=>document.querySelector('#product-state').textContent==='Bingkai aktif: Round Spectacles.');
    await page.route('**/glasses-alt.glb',route=>route.fulfill({status:404,body:'Controlled missing frame'}));
    await page.locator('[data-product="1"]').click();
    await page.waitForFunction(()=>document.querySelector('#product-state').textContent.includes('gagal dimuat'));
    const retained=await page.evaluate(()=>document.querySelector('[data-product="2"]').getAttribute('aria-pressed')==='true'&&document.querySelector('#product-state').textContent.includes('tetap Round Spectacles'));
    await page.unrouteAll({behavior:'ignoreErrors'});
    await page.locator('[data-product="0"]').focus();await page.keyboard.press('Space');
    await page.waitForFunction(()=>document.querySelector('[data-product="0"]').getAttribute('aria-pressed')==='true');
    const keyboard=await page.evaluate(()=>document.activeElement===document.querySelector('[data-product="0"]'));
    await page.route('**/glasses-alt.glb',async route=>{await page.evaluate(()=>{window.choiceBlocked=true;});await new Promise(resolve=>{release=resolve;});await route.continue().catch(()=>{});});
    await page.evaluate(()=>{window.choiceBlocked=false;});await page.locator('[data-product="1"]').click();await page.waitForFunction(()=>window.choiceBlocked);
    await page.evaluate(()=>{const field=document.querySelector('#camera-fov');field.value='64';field.dispatchEvent(new Event('change',{bubbles:true}));});
    release?.();await page.unrouteAll({behavior:'ignoreErrors'});
    const recreated=await page.evaluate(()=>document.querySelector('#product-state').textContent==='Pilihan: Contour.'&&document.querySelector('[data-product="0"]').getAttribute('aria-pressed')==='true');
    await page.evaluate(()=>{window.choiceChanges=0;window.choiceObserver=new MutationObserver(()=>window.choiceChanges++);choiceObserver.observe(document.querySelector('#product-state'),{childList:true,subtree:true,characterData:true});});
    await page.waitForTimeout(500);
    const stable=await page.evaluate(()=>{choiceObserver.disconnect();return choiceChanges===0;});
    const views=[];
    for(const [width,height,label] of [[1360,1000,'desktop'],[390,844,'mobile']]){
      await page.setViewportSize({width,height});await page.screenshot({path:'docs/evidence/shopper-flow-'+label+'.png',fullPage:true});
      views.push(await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,advancedCollapsed:!document.querySelector('#developer-tools').open,collectionFirst:Boolean(document.querySelector('.collection').compareDocumentPosition(document.querySelector('#developer-tools'))&Node.DOCUMENT_POSITION_FOLLOWING)})));
    }
    const cameraCalls=await page.evaluate(()=>choiceCameraCalls);
    return {pass:responsive&&latest&&retained&&keyboard&&recreated&&stable&&cameraCalls===0&&views.every(v=>!v.overflow&&v.advancedCollapsed&&v.collectionFirst),responsive,latest,retained,keyboard,recreated,stable,cameraCalls,views,scope:'Reference integration with real GLBs and deliberately blocked/failed swaps, keyboard focus and desktop/mobile viewports. No camera or recognition, no person data. Selection/description state only; no physical visual-fit or screen-reader acceptance.'};
  }finally{release?.();await page.unrouteAll({behavior:'ignoreErrors'});}
}

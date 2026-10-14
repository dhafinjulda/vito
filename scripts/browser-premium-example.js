/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
async page=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.evaluate(()=>{window.cameraCalls=0;navigator.mediaDevices.getUserMedia=async()=>{window.cameraCalls++;throw Error('Test forbids physical camera');};});
  const controls=page.locator('.fit-panel').filter({has:page.locator('#camera-compositing')});await controls.locator('summary').click();
  const initial={compositing:await page.locator('#camera-compositing').isChecked(),hair:await page.locator('#hair-occlusion').isChecked()};
  await page.locator('#camera-fov').fill('100');await page.locator('#camera-fov').dispatchEvent('change');
  const invalidRejected=await page.locator('#start').isDisabled();
  await page.locator('#camera-fov').fill('65');await page.locator('#camera-fov').dispatchEvent('change');
  await page.locator('#eye-reference').fill('9.1');await page.locator('#eye-reference').dispatchEvent('change');
  await page.locator('#hair-occlusion').uncheck();await page.locator('#hair-occlusion').check();
  await page.waitForTimeout(1500);
  const state=await page.evaluate(()=>({cameraCalls:window.cameraCalls,startEnabled:!document.querySelector('#start').disabled,controlsEnabled:[...document.querySelectorAll('#camera-compositing,#hair-occlusion,#camera-fov,#eye-reference')].every(e=>!e.disabled),videoCount:document.querySelectorAll('#try-on video').length,canvasCount:document.querySelectorAll('#try-on canvas').length,eyeReference:document.querySelector('#eye-reference').value,url:location.href}));
  return {date:'2026-10-13',cameraRequested:false,initial,invalidRejected,state,errors,pass:initial.compositing&&initial.hair&&invalidRejected&&state.cameraCalls===0&&state.startEnabled&&state.controlsEnabled&&state.videoCount===1&&state.canvasCount===1&&state.eyeReference==='9.1'&&!state.url.includes('9.1')&&errors.length===0,limitations:'Actual Vanilla page/public SDK configuration and recreation only. No physical camera or fit-quality acceptance.'};
}

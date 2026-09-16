import './background.js';

const PANEL_PATH='sidepanel-v4.html';

async function ensureSidePanel(){
  try{
    await chrome.sidePanel.setOptions({path:PANEL_PATH,enabled:true});
  }catch(error){
    console.warn('GS side panel setOptions',error);
  }
  try{
    await chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true});
  }catch(error){
    console.warn('GS side panel behavior',error);
  }
}

// Reaplica a configuração também em reload/startup da extensão. Antes ela dependia
// principalmente do onInstalled, então o painel podia deixar de abrir após reloads.
ensureSidePanel();
chrome.runtime.onInstalled.addListener(()=>{ensureSidePanel();});
chrome.runtime.onStartup.addListener(()=>{ensureSidePanel();});

// Fallback explícito para o clique no ícone da extensão. O sidePanel.open é permitido
// aqui porque o clique é uma ação direta do usuário.
chrome.action.onClicked.addListener(async tab=>{
  await ensureSidePanel();
  if(!tab?.id)return;
  try{
    await chrome.sidePanel.open({tabId:tab.id});
  }catch(error){
    console.warn('GS side panel open',error);
  }
});

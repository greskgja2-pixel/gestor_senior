import './background.js';

const PANEL_PATH='sidepanel-v4.html';

async function ensureSidePanel(tabId=null){
  // Mantém uma configuração global válida.
  try{
    await chrome.sidePanel.setOptions({path:PANEL_PATH,enabled:true});
  }catch(error){
    console.warn('GS side panel global setOptions',error);
  }

  // Reaplica também por aba. Isso limpa opções antigas/stale que o Chrome pode
  // conservar por tab e que resultavam em um painel lateral branco mesmo com a
  // extensão carregada corretamente.
  if(Number.isInteger(tabId)){
    try{
      await chrome.sidePanel.setOptions({tabId,path:PANEL_PATH,enabled:true});
    }catch(error){
      console.warn('GS side panel tab setOptions',error);
    }
  }

  try{
    await chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true});
  }catch(error){
    console.warn('GS side panel behavior',error);
  }
}

async function ensureActiveTab(){
  try{
    const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
    await ensureSidePanel(tab?.id??null);
  }catch(error){
    console.warn('GS side panel active tab bootstrap',error);
    await ensureSidePanel();
  }
}

// Reaplica a configuração em reload/startup da extensão e também quando a aba ativa
// muda. O objetivo é nunca depender de um estado antigo salvo pelo Chrome.
ensureActiveTab();
chrome.runtime.onInstalled.addListener(()=>{ensureActiveTab();});
chrome.runtime.onStartup.addListener(()=>{ensureActiveTab();});
chrome.tabs.onActivated.addListener(({tabId})=>{ensureSidePanel(tabId);});

// Clique no ícone = força o caminho correto PARA ESTA ABA e só então abre o painel.
chrome.action.onClicked.addListener(async tab=>{
  if(!tab?.id)return;
  await ensureSidePanel(tab.id);
  try{
    await chrome.sidePanel.open({tabId:tab.id});
  }catch(error){
    console.warn('GS side panel open',error);
  }
});

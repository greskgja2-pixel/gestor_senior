"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {fetchJsonWithTimeout,classifyAsyncError} from "../lib/client-async";

export default function RefreshButton({apiPath,label="↻ Atualizar da Shopee",timeoutMs=30000}){
  const router=useRouter();
  const [phase,setPhase]=useState("idle");
  const [message,setMessage]=useState("");

  async function handleClick(){
    if(phase==="loading")return;
    setPhase("loading");setMessage("");
    try{
      await fetchJsonWithTimeout(`${apiPath}?refresh=1`,{cache:"no-store"},timeoutMs);
      setPhase("success");setMessage("Atualização concluída.");
      router.refresh();
    }catch(error){
      console.error("[RefreshButton] atualização falhou",apiPath,error);
      const kind=classifyAsyncError(error);
      setPhase(kind);
      setMessage(kind==="timeout"
        ?`A atualização excedeu ${Math.ceil(timeoutMs/1000)} segundos. Tente novamente.`
        :String(error?.message||error));
    }
  }

  const failed=phase==="error"||phase==="timeout";
  return <div>
    <button className="gs-action" onClick={handleClick} disabled={phase==="loading"}>
      {phase==="loading"?"Atualizando…":failed?"↻ Tentar novamente":label}
    </button>
    {phase==="success"&&<div className="gs-muted" style={{marginTop:7}}>Atualização concluída com dados retornados pela fonte.</div>}
    {failed&&<div className="gs-error-state" style={{marginTop:8}}>{message}</div>}
  </div>;
}

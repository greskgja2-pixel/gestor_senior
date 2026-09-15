"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const VERSION = "20260915-14";
const FRAME_SRC = `/shopeeos-live.html?v=full-live-${VERSION}`;

const STYLES = [
  ["shell-enhancements-css", "/shell-enhancements.css"],
  ["legacy-themes-css", "/legacy-themes.css"],
  ["runtime-restoration-css", "/runtime-restoration.css"],
  ["live-modules-css", "/live-modules.css"],
  ["advanced-modules-css", "/advanced-modules.css"],
  ["editor-ai-css", "/editor-ai.css"],
  ["editor-variations-css", "/editor-variations.css"],
  ["editor-images-css", "/editor-images.css"],
  ["editor-shipping-css", "/editor-shipping.css"],
  ["editor-other-css", "/editor-other.css"],
  ["products-profit-enhancements-css", "/products-profit-enhancements.css"],
  ["product-trends-css", "/product-trends.css"],
  ["home-encyclopedia-css", "/home-encyclopedia.css"],
  ["product-encyclopedia-v6-css", "/product-encyclopedia-v6.css"],
  ["ads-shopee-replica-v11-css", "/ads-shopee-replica-v11.css"],
  ["layout-wide-v2-css", "/layout-wide-v2.css"],
];

const CORE_SCRIPTS = [
  ["runtime-restoration-js", "/runtime-restoration.js"],
  ["live-modules-js", "/live-modules.js"],
  ["shell-enhancements-js", "/shell-enhancements.js"],
];

const OPTIONAL_SCRIPTS = [
  ["advanced-modules-js", "/advanced-modules.js"],
  ["remaining-modules-js", "/remaining-modules.js"],
  ["editor-ai-js", "/editor-ai.js"],
  ["editor-variations-js", "/editor-variations.js"],
  ["editor-images-js", "/editor-images.js"],
  ["editor-shipping-js", "/editor-shipping.js"],
  ["editor-other-js", "/editor-other.js"],
  ["products-profit-enhancements-js", "/products-profit-enhancements.js"],
  ["product-trends-js", "/product-trends.js"],
  ["home-encyclopedia-js", "/home-encyclopedia.js"],
  ["product-encyclopedia-v6-js", "/product-encyclopedia-v6.js"],
  ["product-encyclopedia-v6-grid-js", "/product-encyclopedia-v6-grid.js"],
  ["persistence-fix-v8-js", "/persistence-fix-v8.js"],
  ["ads-shopee-replica-v11-js", "/ads-shopee-replica-v11.js"],
  ["extension-intelligence-integration-js", "/extension-intelligence-integration.js"],
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function loadStyle(doc, key, href) {
  if (!doc?.head) return Promise.reject(new Error("iframe sem <head>"));
  const selector = `link[data-${key}]`;
  const existing = doc.querySelector(selector);
  if (existing?.dataset.gsLoaded === "1") return Promise.resolve();
  return new Promise((resolve) => {
    const link = existing || doc.createElement("link");
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      link.dataset.gsLoaded = "1";
      resolve();
    };
    link.addEventListener("load", done, { once: true });
    link.addEventListener("error", done, { once: true });
    if (!existing) {
      link.rel = "stylesheet";
      link.href = `${href}?v=${VERSION}`;
      link.setAttribute(`data-${key}`, "1");
      doc.head.appendChild(link);
    }
    setTimeout(done, 5000);
  });
}

function loadScript(doc, key, src, attempt = 0) {
  if (!doc?.body) return Promise.reject(new Error("iframe sem <body>"));
  const selector = `script[data-${key}]`;
  const existing = doc.querySelector(selector);
  if (existing?.dataset.gsLoaded === "1") return Promise.resolve();
  if (existing) existing.remove();

  return new Promise((resolve, reject) => {
    const script = doc.createElement("script");
    const timeout = setTimeout(() => {
      script.remove();
      reject(new Error(`timeout ao carregar ${src}`));
    }, 9000);
    script.async = false;
    script.src = `${src}?v=${VERSION}${attempt ? `&retry=${attempt}` : ""}`;
    script.setAttribute(`data-${key}`, "1");
    script.onload = () => {
      clearTimeout(timeout);
      script.dataset.gsLoaded = "1";
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timeout);
      script.remove();
      reject(new Error(`falha ao carregar ${src}`));
    };
    doc.body.appendChild(script);
  });
}

async function loadRequiredScript(doc, key, src) {
  try {
    await loadScript(doc, key, src, 0);
  } catch (firstError) {
    await sleep(250);
    await loadScript(doc, key, src, 1).catch(() => {
      throw firstError;
    });
  }
}

async function waitForModernHome(doc) {
  const win = doc?.defaultView;
  for (let i = 0; i < 80; i += 1) {
    const liveReady = !!win?.GestorLiveModules?.supports?.("dashboard");
    const modernContent = !!doc?.querySelector("#content .lm-wrap");
    const modernNav = !!doc?.querySelector("#nav .shell-page");
    if (liveReady && modernContent && modernNav) return true;
    await sleep(100);
  }
  throw new Error("o painel moderno não ficou pronto a tempo");
}

async function installEnhancements(frame) {
  const doc = frame?.contentDocument;
  const win = doc?.defaultView;
  if (!doc?.head || !doc?.body || !win) throw new Error("iframe ainda não está pronto");
  if (doc.documentElement.dataset.gestorReady === VERSION) return true;
  if (win.__GESTOR_INSTALL_PROMISE__) return win.__GESTOR_INSTALL_PROMISE__;

  win.__GESTOR_INSTALL_PROMISE__ = (async () => {
    doc.documentElement.dataset.gestorEnhancements = VERSION;
    doc.documentElement.dataset.gestorInstalling = VERSION;

    const stylePromises = new Map();
    for (const [key, href] of STYLES) stylePromises.set(key, loadStyle(doc, key, href));
    await Promise.allSettled([
      stylePromises.get("shell-enhancements-css"),
      stylePromises.get("runtime-restoration-css"),
      stylePromises.get("live-modules-css"),
      stylePromises.get("layout-wide-v2-css"),
    ]);

    for (const [key, src] of CORE_SCRIPTS) await loadRequiredScript(doc, key, src);
    await waitForModernHome(doc);

    doc.documentElement.dataset.gestorReady = VERSION;
    delete doc.documentElement.dataset.gestorInstalling;

    (async () => {
      for (const [key, src] of OPTIONAL_SCRIPTS) {
        try {
          await loadRequiredScript(doc, key, src);
        } catch (error) {
          console.warn("Gestor Senior optional enhancement failed", src, error);
        }
      }
    })();
    return true;
  })();

  try {
    return await win.__GESTOR_INSTALL_PROMISE__;
  } catch (error) {
    win.__GESTOR_INSTALL_PROMISE__ = null;
    delete doc.documentElement.dataset.gestorInstalling;
    throw error;
  }
}

export default function ShopeeLiveFrame() {
  const frameRef = useRef(null);
  const recoveryRef = useRef(0);
  const bootingRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("Preparando seu painel…");

  const boot = useCallback(async () => {
    if (bootingRef.current) return;
    bootingRef.current = true;
    setReady(false);
    setMessage(recoveryRef.current ? "Finalizando o painel…" : "Preparando seu painel…");
    try {
      await installEnhancements(frameRef.current);
      recoveryRef.current = 0;
      setReady(true);
    } catch (error) {
      console.error("Gestor Senior enhancement install failed", error);
      if (recoveryRef.current < 2 && frameRef.current) {
        recoveryRef.current += 1;
        setMessage("Ajustando o carregamento automaticamente…");
        frameRef.current.src = `${FRAME_SRC}&recovery=${Date.now()}-${recoveryRef.current}`;
      } else {
        setMessage("Não foi possível preparar o painel. Tentando novamente…");
        setTimeout(() => {
          recoveryRef.current = 0;
          if (frameRef.current) frameRef.current.src = `${FRAME_SRC}&retry=${Date.now()}`;
        }, 1800);
      }
    } finally {
      bootingRef.current = false;
    }
  }, []);

  const handleLoad = useCallback(() => { boot(); }, [boot]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const doc = frameRef.current?.contentDocument;
      if (!ready && doc?.readyState === "complete") boot();
    }, 700);
    return () => clearTimeout(timer);
  }, [boot, ready]);

  return (
    <>
      <iframe ref={frameRef} src={FRAME_SRC} title="Gestor Senior Shopee LIVE" onLoad={handleLoad} style={{position:"fixed",inset:0,width:"100vw",height:"100vh",border:"none",zIndex:9999,opacity:ready?1:0,visibility:ready?"visible":"hidden",transition:"opacity .16s ease"}} />
      {!ready && <div role="status" aria-live="polite" style={{position:"fixed",inset:0,zIndex:10000,display:"grid",placeItems:"center",background:"#07111d",color:"#edf5fd",fontFamily:"system-ui, -apple-system, Segoe UI, sans-serif"}}><div style={{textAlign:"center",maxWidth:360,padding:24}}><div style={{width:54,height:54,margin:"0 auto 14px",display:"grid",placeItems:"center",border:"1px solid #d7b33d",borderRadius:15,color:"#f2d36d",fontWeight:900,fontSize:21}}>GS</div><strong style={{display:"block",fontSize:18}}>Gestor Sênior</strong><span style={{display:"block",marginTop:6,color:"#91a5b9",fontSize:13}}>{message}</span><div style={{width:180,height:3,margin:"16px auto 0",borderRadius:99,overflow:"hidden",background:"#16263a"}}><div style={{width:"58%",height:"100%",borderRadius:99,background:"#d7b33d",animation:"gsLoaderPulse 1s ease-in-out infinite alternate"}} /></div><style>{`@keyframes gsLoaderPulse{from{transform:translateX(-55%)}to{transform:translateX(115%)}}`}</style></div></div>}
    </>
  );
}

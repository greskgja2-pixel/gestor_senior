"use client";

import { useCallback, useRef } from "react";

const VERSION = "20260914-07";

const STYLES = [
  ["shell-enhancements-css", "/shell-enhancements.css"],
  ["legacy-themes-css", "/legacy-themes.css"],
  ["runtime-restoration-css", "/runtime-restoration.css"],
  ["live-modules-css", "/live-modules.css"],
  ["ads-control-v7-css", "/ads-control-v7.css"],
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
];

const SCRIPTS = [
  ["shell-enhancements-js", "/shell-enhancements.js"],
  ["runtime-restoration-js", "/runtime-restoration.js"],
  ["live-modules-js", "/live-modules.js"],
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
  ["ads-product-scope-fix-js", "/ads-product-scope-fix.js"],
  ["ads-control-v7-js", "/ads-control-v7.js"],
];

function addStyle(doc, key, href) { if (!doc?.head || doc.querySelector(`link[data-${key}]`)) return; const link=doc.createElement("link"); link.rel="stylesheet"; link.href=`${href}?v=${VERSION}`; link.setAttribute(`data-${key}`,"1"); doc.head.appendChild(link); }
function addScript(doc,key,src){if(!doc?.body||doc.querySelector(`script[data-${key}]`))return;const script=doc.createElement("script");script.src=`${src}?v=${VERSION}`;script.async=false;script.setAttribute(`data-${key}`,"1");doc.body.appendChild(script);}
function installEnhancements(frame){const doc=frame?.contentDocument;if(!doc?.head||!doc?.body)return false;if(doc.documentElement.dataset.gestorEnhancements===VERSION)return true;doc.documentElement.dataset.gestorEnhancements=VERSION;STYLES.forEach(([key,href])=>addStyle(doc,key,href));SCRIPTS.forEach(([key,src])=>addScript(doc,key,src));return true;}
export default function ShopeeLiveFrame(){const frameRef=useRef(null);const handleLoad=useCallback(()=>{try{installEnhancements(frameRef.current);}catch(error){console.error("Gestor Senior enhancement install failed",error);}},[]);return <iframe ref={frameRef} src={`/shopeeos-live.html?v=full-live-${VERSION}`} title="Gestor Senior Shopee LIVE" onLoad={handleLoad} style={{position:"fixed",inset:0,width:"100vw",height:"100vh",border:"none",zIndex:9999}}/>;}

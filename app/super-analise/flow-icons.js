const PATHS={
  check:<path d="M4 12.5l5 5L20 6.5"/>,
  sliders:<><path d="M4 7h8M18 7h2M4 17h2M12 17h8"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/></>,
  users:<><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.2a3 3 0 010 5.6M21 20c0-2.6-1.6-4.8-4-5.7"/></>,
  sparkles:<><path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z"/><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></>,
  tag:<><path d="M3 12V4a1 1 0 011-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.4"/></>,
  cart:<><path d="M3 4h2.5l2 11h10l2-8H7"/><circle cx="9" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/></>,
  cartOff:<><path d="M3 4h2.5l2 11h10l2-8H7"/><circle cx="9" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/><path d="M3 21L21 3"/></>,
  star:<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>,
  chat:<path d="M21 12a8 8 0 01-11.5 7.2L4 21l1.8-5A8 8 0 1121 12z"/>,
  layers:<><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 12.5l9 5 9-5"/><path d="M3 17l9 5 9-5"/></>,
  clipboard:<><rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4h6v3H9z"/><path d="M8.5 14l2.5 2.5 4.5-5"/></>,
  target:<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/></>,
  ads:<><path d="M3 11v3a1 1 0 001 1h3l6 4V6L7 10H4a1 1 0 00-1 1z"/><path d="M17 9a4 4 0 010 6"/></>,
  calculator:<><rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 7.5h7M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01"/></>,
  wallet:<><path d="M4 7a2 2 0 012-2h12v4"/><rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M16 13.5h2.5"/></>,
  coin:<><circle cx="12" cy="12" r="9"/><path d="M14.5 9.2c-.6-.8-1.5-1.2-2.6-1.2-1.6 0-2.6.8-2.6 1.9 0 2.7 5.4 1.2 5.4 4 0 1.1-1 1.9-2.7 1.9-1.2 0-2.2-.5-2.8-1.4M12 6.5V8m0 8v1.5"/></>,
  chart:<path d="M3 20h18M6 16V9m6 7V5m6 11v-6"/>,
  alert:<><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/></>,
  arrowLeft:<path d="M19 12H5M11 6l-6 6 6 6"/>,
  arrowRight:<path d="M5 12h14M13 6l6 6-6 6"/>,
  trendUp:<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>,
  trendDown:<path d="M3 7l6 6 4-4 8 8M15 17h6v-6"/>,
  minus:<path d="M5 12h14"/>,
  eye:<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
  help:<><circle cx="12" cy="12" r="9.5"/><path d="M9.2 9.5a2.8 2.8 0 015.4 1c0 1.8-2.6 2.2-2.6 4M12 17.8v.01"/></>,
  external:<><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/></>,
  photo:<><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M4 18l5-5 4 4 3-3 4 4"/></>,
  sprout:<><path d="M12 21v-9"/><path d="M12 12c0-4 3-6 7-6 0 4-3 6-7 6z"/><path d="M12 15c0-3-2-5-6-5 0 3 2 5 6 5z"/></>,
  waves:<path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/>,
  percent:<><path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.2"/><circle cx="17" cy="17" r="2.2"/></>,
  pencil:<><path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/></>
};

export default function FlowIcon({name,size=16,className}){
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{PATHS[name]||PATHS.help}</svg>;
}

export default function SuperAnaliseLayout({children}){
  return <>
    <style>{`
      body{
        background:#f5f8fc !important;
        background-image:none !important;
        color:#14213d !important;
      }
      body > .shell{
        max-width:none !important;
        width:100% !important;
        margin:0 !important;
        padding:0 !important;
      }
      body > .shell > .topbar{
        display:none !important;
      }
    `}</style>
    {children}
  </>;
}

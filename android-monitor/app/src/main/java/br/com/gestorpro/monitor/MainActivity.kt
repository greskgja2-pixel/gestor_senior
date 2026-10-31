package br.com.gestorpro.monitor

import android.app.Activity
import android.app.AlertDialog
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.widget.*
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.concurrent.thread

class MainActivity:Activity() {
 private val dark=Color.rgb(7,9,27)
 private val navy=Color.rgb(19,23,53)
 private val cyan=Color.rgb(0,238,255)
 private val pink=Color.rgb(255,51,198)
 private val green=Color.rgb(116,255,119)
 private val muted=Color.rgb(178,193,221)
 private lateinit var root:LinearLayout
 private lateinit var body:LinearLayout
 private lateinit var status:TextView
 private var page="home"
 private var items:List<Api.Product> = emptyList()
 private fun text(s:String,size:Int=14,color:Int=Color.WHITE,bold:Boolean=false)=TextView(this).apply {
  text=s;textSize=size.toFloat();setTextColor(color);setPadding(12,12,12,12)
  if(bold)setTypeface(null,Typeface.BOLD)
 }
 private fun panel(color:Int):GradientDrawable=GradientDrawable().apply {
  setColor(navy);cornerRadius=23f;setStroke(2,color)
 }
 private fun button(s:String,color:Int,onTap:()->Unit)=Button(this).apply{
  text=s;textSize=12f;isAllCaps=false;setTextColor(Color.WHITE);background=panel(color)
  setOnClickListener{onTap()}
 }
 private fun box(title:String,value:String,accent:Int,detail:String){
  val container=LinearLayout(this).apply {orientation=LinearLayout.VERTICAL;setPadding(10,6,10,6);background=panel(accent)}
  container.addView(text(title,12,muted))
  container.addView(text(value,23,accent,true))
  container.addView(text(detail,12,muted))
  val lp=LinearLayout.LayoutParams(-1,-2);lp.setMargins(0,8,0,8);body.addView(container,lp)
 }
 private fun action(s:String,color:Int,onTap:()->Unit){
  val lp=LinearLayout.LayoutParams(-1,-2);lp.setMargins(0,5,0,5);body.addView(button(s,color,onTap),lp)
 }
 override fun onCreate(savedInstanceState:Bundle?){
  super.onCreate(savedInstanceState);window.statusBarColor=dark;window.navigationBarColor=dark
  root=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setBackgroundColor(dark);setPadding(18,20,18,12)}
  root.addView(text("◆ GESTOR PRO MONITOR",24,cyan,true))
  root.addView(text("NEON CONTROL • SUPABASE • ANDROID",12,pink,true))
  val tabs=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL}
  tabs.addView(button("PAINEL",cyan){page="home";render()},LinearLayout.LayoutParams(0,-2,1f))
  tabs.addView(button("PRODUTOS",pink){page="products";loadProducts()},LinearLayout.LayoutParams(0,-2,1f))
  root.addView(tabs)
  body=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL}
  root.addView(ScrollView(this).apply{addView(body)},LinearLayout.LayoutParams(-1,0,1f))
  status=text("",12,muted);root.addView(status)
  setContentView(root)
  if(Api.signed(this)){MonitorWorker.schedule(this);refreshCounts()}else render()
 }
 private fun render(){
  body.removeAllViews()
  if(!Api.signed(this)){loginScreen();return}
  if(page=="products")productScreen() else homeScreen()
 }
 private fun loginScreen(){
  box("SUPABASE","Entrar",cyan,"Use o usuário do Supabase Authentication")
  val email=EditText(this).apply{hint="E-mail";inputType=33;setTextColor(Color.WHITE);setHintTextColor(muted)}
  val pass=EditText(this).apply{hint="Senha";inputType=129;setTextColor(Color.WHITE);setHintTextColor(muted)}
  body.addView(email);body.addView(pass)
  action("ENTRAR E ATIVAR SINCRONIZAÇÃO",green){
   val e=email.text.toString().trim();val p=pass.text.toString()
   if(e.isBlank()||p.isBlank())status.text="Informe e-mail e senha"
   else task("Autenticando..."){
    Api.signIn(this,e,p);MonitorWorker.schedule(this);Api.readTotals(this);"Conectado ao Supabase"
   }
  }
 }
 private fun homeScreen(){
  val prefs=getSharedPreferences("gp_sync",MODE_PRIVATE)
  box("● STATUS","CONECTADO",green,"Sincronização ativa • coleta Shopee ainda não implementada")
  box("PRODUTOS MONITORADOS",prefs.getInt("products",0).toString(),cyan,"Produtos ativos cadastrados")
  box("PESQUISAS CADASTRADAS",prefs.getInt("searches",0).toString(),pink,"Pesquisas ativas")
  box("AGENDAMENTO","6 HORAS",green,"O Android pode atrasar a execução com tela bloqueada")
  val last=prefs.getLong("last_sync",0L)
  val date=if(last==0L)"Não realizada" else SimpleDateFormat("dd/MM HH:mm",Locale("pt","BR")).format(Date(last))
  box("ÚLTIMA SINCRONIZAÇÃO",date,cyan,"Consulta de lista • não é coleta de anúncios")
  val error=prefs.getString("last_error","")
  if(!error.isNullOrBlank())box("ÚLTIMO ERRO",error.take(110),pink,"Verifique a conexão")
  action("↻ SINCRONIZAR AGORA",cyan){refreshCounts()}
  action("▣ GERENCIAR PRODUTOS",pink){page="products";loadProducts()}
  action("SAIR DA CONTA",pink){
   AlertDialog.Builder(this).setTitle("Sair da conta?")
    .setMessage("O agendamento neste celular será cancelado.")
    .setNegativeButton("Cancelar",null)
    .setPositiveButton("Sair"){_,_->MonitorWorker.stop(this);Api.signOut(this);render()}.show()
  }
  body.addView(text("Uso do Supabase: métricas do plano ainda não disponíveis. Nenhum percentual estimado será mostrado.",12,muted))
 }
 private fun productScreen(){
  box("PRODUTOS CADASTRADOS",items.size.toString(),cyan,
   items.count{it.active}.toString()+" ativos • "+items.count{!it.active}.toString()+" pausados")
  action("↻ ATUALIZAR PRODUTOS",cyan){loadProducts()}
  for(item in items){
   val container=LinearLayout(this).apply {orientation=LinearLayout.VERTICAL;setPadding(12,8,12,8);background=panel(if(item.active)cyan else muted)}
   container.addView(text(item.title.take(110),15,Color.WHITE,true))
   container.addView(text(if(item.active)"● ATIVO" else "○ PAUSADO",12,if(item.active)green else muted))
   container.addView(button(if(item.active)"PAUSAR MONITORAMENTO" else "REATIVAR MONITORAMENTO",if(item.active)pink else green){
    AlertDialog.Builder(this).setTitle(if(item.active)"Pausar este produto?" else "Reativar produto?")
     .setMessage(item.title.take(150)+"\n\nO histórico existente será preservado.")
     .setNegativeButton("Cancelar",null)
     .setPositiveButton("Confirmar"){_,_->task("Atualizando produto..."){
      Api.setProductActive(this,item.id,!item.active)
      Api.readTotals(this);items=Api.products(this);"Produto atualizado"
     }}.show()
   })
   val lp=LinearLayout.LayoutParams(-1,-2);lp.setMargins(0,5,0,9);body.addView(container,lp)
  }
 }
 private fun refreshCounts(){task("Sincronizando..."){val pair=Api.readTotals(this);"Sincronizado: "+pair.first+" produtos, "+pair.second+" pesquisas"}}
 private fun loadProducts(){task("Carregando lista..."){items=Api.products(this);"Lista carregada: "+items.size+" produtos"}}
 private fun task(message:String,work:()->String){
  status.text=message
  thread{
   val result=try{work()}catch(e:Exception){"Falha: "+(e.message?:"erro desconhecido")}
   runOnUiThread{status.text=result;render()}
  }
 }
}
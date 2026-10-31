package br.com.gestorpro.monitor
import android.app.Activity
import android.app.AlertDialog
import android.os.Bundle
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.View
import android.widget.*
import kotlin.concurrent.thread
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity:Activity(){
 private val bg=Color.rgb(9,10,31)
 private val cyan=Color.rgb(0,242,255)
 private val pink=Color.rgb(255,49,184)
 private val lime=Color.rgb(127,255,91)
 private val yellow=Color.rgb(255,220,68)
 private lateinit var root:LinearLayout
 private lateinit var status:TextView
 private lateinit var email:EditText
 private lateinit var pass:EditText
 private fun shape(color:Int,stroke:Int=cyan)=GradientDrawable().apply{
  cornerRadius=26f;setColor(color);setStroke(2,stroke)
 }
 private fun label(s:String,size:Float=16f,color:Int=Color.WHITE)=TextView(this).apply {
  text=s;textSize=size;setTextColor(color);setPadding(6,10,6,10)
 }
 private fun button(s:String,color:Int,onClick:()->Unit)=Button(this).apply{
  text=s;isAllCaps=false;setTextColor(bg);background=shape(color,color)
  setOnClickListener{onClick()}
 }
 private fun card(title:String,value:String,color:Int):LinearLayout=LinearLayout(this).apply {
  orientation=LinearLayout.VERTICAL;background=shape(Color.rgb(22,23,55),color);setPadding(22,12,22,12)
  addView(label(title,13f,color));addView(label(value,25f,Color.WHITE))
  val lp=LinearLayout.LayoutParams(-1,-2);lp.bottomMargin=16;layoutParams=lp
 }
 private fun reset(title:String){
  root=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(28,36,28,28);setBackgroundColor(bg)}
  val scroll=ScrollView(this).apply{fillViewport=true;addView(root)}
  setContentView(scroll)
  root.addView(label("⚡ GESTOR PRO MONITOR",24f,cyan))
  root.addView(label(title,16f,pink))
 }
 override fun onCreate(savedInstanceState:Bundle?){super.onCreate(savedInstanceState);dashboard()}
 private fun task(action:()->String,done:(String)->Unit){
  status.text="⏳ Processando..."
  thread {
   val result=try{action()}catch(e:Exception){"ERRO: "+(e.message?:"falha desconhecida")}
   runOnUiThread{done(result)}
  }
 }
 private fun dashboard(message:String?=null){
  reset("Painel neon • Supabase shopeeos")
  if(!Api.signed(this)){
   root.addView(label("Faça login com seu usuário Supabase Auth.",15f))
   email=EditText(this).apply{hint="E-mail";setTextColor(Color.WHITE);setHintTextColor(cyan);inputType=33}
   pass=EditText(this).apply{hint="Senha";setTextColor(Color.WHITE);setHintTextColor(cyan);inputType=129}
   root.addView(email);root.addView(pass)
   root.addView(button("ENTRAR E ATIVAR 6H",lime){
    val e=email.text.toString();val p=pass.text.toString()
    task({Api.signIn(this,e,p);MonitorWorker.schedule(this);"Conectado com sucesso"}, {dashboard(it)})
   })
  }else{
   root.addView(card("CONEXÃO", "● Autenticado",lime))
   val last=Api.lastSync(this)
   root.addView(card("ÚLTIMA SINCRONIZAÇÃO",if(last==0L)"Nunca" else SimpleDateFormat("dd/MM HH:mm",Locale("pt","BR")).format(Date(last)),cyan))
   root.addView(card("PRÓXIMA TENTATIVA", "Intervalo: 6 horas*",pink))
   root.addView(label("*O Android pode atrasar a execução. Sincronização não é coleta Shopee.",12f,yellow))
   val counters= getSharedPreferences("gp_sync",MODE_PRIVATE)
   root.addView(card("PRODUTOS ATIVOS",counters.getInt("products",0).toString(),lime))
   root.addView(card("PESQUISAS ATIVAS",counters.getInt("searches",0).toString(),cyan))
   root.addView(button("📦 GERENCIAR PRODUTOS",pink){productScreen()})
   root.addView(button("🔄 SINCRONIZAR AGORA",cyan){
    task({val(p,s)=Api.readTotals(this);"$p produtos ativos • $s pesquisas ativas"}, {dashboard(it)})
   })
   root.addView(button("SAIR",yellow){MonitorWorker.stop(this);Api.signOut(this);dashboard("Sessão encerrada")})
  }
  status=label(message ?: "Aguardando",14f,yellow);root.addView(status)
 }
 private fun productScreen(){
  reset("Produtos monitorados")
  root.addView(button("← VOLTAR AO PAINEL",cyan){dashboard()})
  val search=EditText(this).apply{hint="Pesquisar pelo nome";setTextColor(Color.WHITE);setHintTextColor(cyan)}
  root.addView(search)
  val list=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL}
  root.addView(list)
  status=label("Carregando lista...",14f,yellow);root.addView(status)
  thread{
   try{
    val products=Api.products(this)
    runOnUiThread{
     fun render(){
      list.removeAllViews()
      val filtered=products.filter{it.title.contains(search.text.toString(),true)}
      list.addView(label("Total: ${products.size} • Ativos: ${products.count{it.active}}",15f,lime))
      filtered.take(250).forEach{item->
       val row=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(12,12,12,12);background=shape(Color.rgb(22,23,55),if(item.active)lime:pink)}
       row.addView(label(item.title.take(140),15f))
       row.addView(button(if(item.active)"⏸ PAUSAR MONITORAMENTO" else "▶ REATIVAR",if(item.active)pink:lime){
        AlertDialog.Builder(this).setTitle(if(item.active)"Pausar produto?" else "Reativar produto?")
         .setMessage("O histórico será preservado. A mudança será sincronizada com o Supabase.")
         .setNegativeButton("Cancelar",null).setPositiveButton("Confirmar"){_,_->
          task({Api.setProductActive(this,item.id,!item.active);"Atualizado no Supabase"},{productScreen()})
         }.show()
       })
       list.addView(row)
      }
      status.text=if(filtered.size>250)"Mostrando 250 de ${filtered.size} resultados. Refine a busca." else "Lista atualizada."
     }
     search.addTextChangedListener(object:android.text.TextWatcher{
      override fun beforeTextChanged(s:CharSequence?,start:Int,count:Int,after:Int){}
      override fun onTextChanged(s:CharSequence?,start:Int,before:Int,count:Int){render()}
      override fun afterTextChanged(s:android.text.Editable?){}
     })
     render()
    }
   }catch(e:Exception){runOnUiThread{status.text="Falha: "+e.message}}
  }
 }
}

package br.com.gestorpro.monitor
import android.app.Activity
import android.os.Bundle
import android.view.View
import android.widget.*
import kotlin.concurrent.thread

class MainActivity:Activity() {
 private lateinit var status:TextView
 private lateinit var email:EditText
 private lateinit var password:EditText
 private lateinit var login:Button
 private lateinit var sync:Button
 private lateinit var logout:Button
 override fun onCreate(savedInstanceState:Bundle?) {
  super.onCreate(savedInstanceState)
  val view=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setPadding(32,48,32,32) }
  fun title(t:String) = TextView(this).apply { text=t; textSize=20f; setPadding(0,12,0,12) }
  view.addView(title("Gestor Pro Monitor • Android"))
  view.addView(title("Sincronização Supabase a cada 6 horas"))
  email=EditText(this).apply { hint="E-mail Supabase Auth"; inputType=33 }
  password=EditText(this).apply { hint="Senha"; inputType=129 }
  view.addView(email);view.addView(password)
  status=title("")
  login=Button(this).apply { text="Entrar e ativar agenda"; setOnClickListener {
   val e=email.text.toString().trim();val p=password.text.toString()
   if(e.isBlank()||p.isBlank()){status.text="Informe e-mail e senha";return@setOnClickListener}
   runTask { Api.signIn(this@MainActivity,e,p); MonitorWorker.schedule(this@MainActivity); "Login realizado; agenda de 360 minutos ativada." }
  } }
  sync=Button(this).apply { text="Sincronizar agora"; setOnClickListener { runTask { val (p,s)=Api.readTotals(this@MainActivity); "$p produtos • $s pesquisas disponíveis" } } }
  logout=Button(this).apply { text="Sair e cancelar agenda"; setOnClickListener {
   MonitorWorker.stop(this@MainActivity);Api.signOut(this@MainActivity);refresh("Sessão encerrada")
  } }
  view.addView(login);view.addView(sync);view.addView(logout);view.addView(status)
  view.addView(TextView(this).apply { text="Versão piloto: sincroniza a lista existente mesmo com a tela bloqueada, quando o Android permitir. Ainda não executa coletas da Shopee nem grava medições." })
  setContentView(ScrollView(this).apply {addView(view)})
  refresh()
 }
 private fun refresh(msg:String?=null) {
  val signed=Api.signed(this)
  email.visibility=if(signed)View.GONE else View.VISIBLE
  password.visibility=email.visibility;login.visibility=email.visibility
  sync.isEnabled=signed;logout.isEnabled=signed
  status.text=msg ?: if(signed) "Conectado • agendamento de 6 horas disponível" else "Faça login para sincronizar"
 }
 private fun runTask(f:()->String) {
  status.text="Sincronizando...";login.isEnabled=false;sync.isEnabled=false
  thread { val result=try{f()}catch(e:Exception){"Falha: "+(e.message ?: "erro desconhecido")}
   runOnUiThread{login.isEnabled=true;sync.isEnabled=true;refresh(result)}
  }
 }
}